import express from 'express';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  refreshDate,
  getStatus,
  getNormalizedForDate,
  preloadNextSixWorkingDays,
} from '../services/fieldRoutesPreloader.js';
import { getAuthStatus, checkAuthHealth } from '../services/fieldRoutesAuth.js';
import { getPlaywrightChromiumDiagnostics } from '../services/playwrightRuntime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const router = express.Router();

/** Interactive login is allowed on this machine (not Render; request from localhost). */
function isInteractiveLoginAllowed(req) {
  if (process.env.RENDER) return false;

  const ip = req.socket?.remoteAddress || '';
  if (
    ip === '127.0.0.1'
    || ip === '::1'
    || ip === '::ffff:127.0.0.1'
    || ip.includes('127.0.0.1')
  ) {
    return true;
  }

  const host = (req.get('host') || '').split(':')[0].toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;

  if (process.env.ALLOW_INTERACTIVE_FIELDROUTES_LOGIN === 'true') return true;

  return false;
}

// GET /api/routes/login-capabilities — whether this server can open the login browser
router.get('/login-capabilities', async (req, res) => {
  const chromium = await getPlaywrightChromiumDiagnostics();
  const onRender = !!process.env.RENDER;
  const allowed = !onRender && isInteractiveLoginAllowed(req);

  let reason = null;
  if (onRender) {
    reason = 'Hosted on Render — run login on your Mac, then set FIELDROUTES_AUTH_STATE_JSON.';
  } else if (!allowed) {
    reason = 'Open the dashboard on this computer at http://localhost:3001 or http://127.0.0.1:5173 (npm run dev).';
  } else if (!chromium.ok) {
    reason = chromium.error || 'Install Chromium: cd server && npm run playwright:install';
  }

  res.json({
    interactiveLoginAvailable: allowed && chromium.ok,
    isRender: onRender,
    chromiumReady: chromium.ok,
    chromiumError: chromium.error || null,
    reason,
    manualCommand: 'node scripts/fieldRoutesLogin.mjs',
  });
});

// GET /api/routes/status — cache status for next 6 working days + auth status
router.get('/status', async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/auth-status — current FieldRoutes auth status (explicit endpoint)
router.get('/auth-status', (req, res) => {
  const auth = getAuthStatus();
  res.json(auth);
});

// POST /api/routes/auth-check — trigger an immediate auth health check
router.post('/auth-check', async (req, res) => {
  try {
    const result = await checkAuthHealth();
    const auth = getAuthStatus();
    res.json({
      result,
      status: auth.status,
      lastCheck: auth.lastCheck,
      message: auth.message,
      _auth: {
        status: auth.status,
        lastCheck: auth.lastCheck,
        message: auth.message,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/payload?date=YYYY-MM-DD — normalized technician data for a date
router.get('/payload', async (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  }
  const data = await getNormalizedForDate(date);
  if (!data) {
    return res.status(404).json({ error: 'No cached data for this date', date });
  }
  res.json(data);
});

// POST /api/routes/refresh?date=YYYY-MM-DD — trigger single-date fetch (fire-and-forget)
router.post('/refresh', (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  }
  res.json({ started: true, date });
  refreshDate(date).catch(err => {
    console.error(`[routes] refresh ${date} failed:`, err.message);
  });
});

// POST /api/routes/login-refresh — spawn the interactive login script (localhost only)
router.post('/login-refresh', async (req, res) => {
  if (process.env.RENDER) {
    return res.status(400).json({
      error: 'Interactive FieldRoutes login is only available on your local machine, not on Render. Run: node scripts/fieldRoutesLogin.mjs — then add FIELDROUTES_AUTH_STATE_JSON in Render.',
    });
  }

  if (!isInteractiveLoginAllowed(req)) {
    return res.status(403).json({
      error: 'Open the dashboard on this computer at http://localhost:3001 or run npm run dev (http://localhost:5173). Remote/LAN URLs cannot launch the login browser.',
    });
  }

  const chromium = await getPlaywrightChromiumDiagnostics();
  if (!chromium.ok) {
    return res.status(500).json({
      error: chromium.error || 'Chromium is not installed.',
      hint: 'cd server && npm run playwright:install',
    });
  }

  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'fieldRoutesLogin.mjs');
  if (!existsSync(scriptPath)) {
    return res.status(500).json({
      error: `Login script not found at ${scriptPath}`,
    });
  }

  const LAUNCH_WAIT_MS = 12000;
  let stdout = '';
  let stderr = '';
  let responded = false;

  const finish = (status, body) => {
    if (responded) return;
    responded = true;
    res.status(status).json(body);
  };

  let child;
  try {
    child = spawn(process.execPath, [scriptPath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return finish(500, { error: `Could not start login script: ${err.message}` });
  }

  const launchTimer = setTimeout(() => {
    if (responded) return;
    child.unref();
    finish(200, {
      started: true,
      message: 'Chromium should be opening. If you do not see a browser window, run: node scripts/fieldRoutesLogin.mjs in a terminal on this computer.',
    });
  }, LAUNCH_WAIT_MS);

  child.stdout.on('data', (d) => {
    const chunk = d.toString();
    stdout += chunk;
    process.stdout.write(`[login-script] ${chunk}`);
    if (!responded && stdout.includes('Browser is open')) {
      clearTimeout(launchTimer);
      child.unref();
      finish(200, {
        started: true,
        message: 'Chromium is open — log in to FieldRoutes, then click “Check Login” on the dashboard.',
      });
    }
  });

  child.stderr.on('data', (d) => {
    const chunk = d.toString();
    stderr += chunk;
    process.stderr.write(`[login-script] ${chunk}`);
  });

  child.on('error', (err) => {
    clearTimeout(launchTimer);
    finish(500, { error: `Login script failed to start: ${err.message}` });
  });

  child.on('exit', async (code) => {
    if (code === 0) {
      try {
        const result = await checkAuthHealth();
        console.log(`[login-script] post-login auth check: ${result}`);
        if (result === 'ok') {
          preloadNextSixWorkingDays({ force: false }).catch(err => {
            console.error('[login-script] post-login preload failed:', err.message);
          });
        }
      } catch (err) {
        console.warn('[login-script] post-login auth check failed:', err.message);
      }
      return;
    }

    if (!responded) {
      clearTimeout(launchTimer);
      const detail = (stderr || stdout).trim().split('\n').filter(Boolean).pop();
      finish(500, {
        error: detail || `Login script exited with code ${code}`,
        hint: 'Run in terminal: node scripts/fieldRoutesLogin.mjs',
      });
    }
  });
});

// POST /api/routes/preload — fire-and-forget preload for next 6 working days
// ?force=true bypasses the 6-hour freshness check and re-scrapes every date
router.post('/preload', (req, res) => {
  const force = req.query.force === 'true';
  res.json({ started: true, force });
  preloadNextSixWorkingDays({ force }).catch(err => {
    console.error('[routes] preload failed:', err.message);
  });
});

export default router;
