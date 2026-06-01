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
  return host === 'localhost' || host === '127.0.0.1';
}

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
// The script opens a Chromium window so the user can log in manually.
// Returns immediately; the browser process runs independently.
router.post('/login-refresh', (req, res) => {
  if (process.env.RENDER) {
    return res.status(400).json({
      error: 'Interactive FieldRoutes login is only available locally. Update FIELDROUTES_AUTH_STATE_JSON in Render instead.',
    });
  }

  if (!isInteractiveLoginAllowed(req)) {
    return res.status(403).json({
      error: 'Interactive login must be started from this computer. Open the dashboard at http://localhost:3001 (or via npm run dev), not from another device on your network.',
    });
  }

  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'fieldRoutesLogin.mjs');
  if (!existsSync(scriptPath)) {
    return res.status(500).json({
      error: `Login script not found at ${scriptPath}`,
    });
  }

  let child;
  try {
    child = spawn(process.execPath, [scriptPath], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return res.status(500).json({ error: `Could not start login script: ${err.message}` });
  }

  child.on('error', (err) => {
    console.error('[login-script] spawn error:', err.message);
  });

  child.stdout.on('data', (d) => process.stdout.write(`[login-script] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[login-script] ${d}`));
  child.on('exit', async (code) => {
    console.log(`[login-script] exited with code ${code}`);
    if (code !== 0) return;

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
  });
  child.unref();

  res.json({
    started: true,
    message: 'Chromium is opening — log in to FieldRoutes in that window. Return here and click “Check Login” when finished.',
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
