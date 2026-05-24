/**
 * FieldRoutes auth state management.
 *
 * Provides a lightweight session health check (raw HTTP, no browser) and a
 * periodic keepalive that prevents PHP server-side session garbage collection.
 *
 * Auth status is persisted to data/fieldroutes-auth-status.json so the widget
 * shows the last known state immediately on page load, even before the first
 * network check completes.
 *
 * Auth state sources:
 * 1. FIELDROUTES_AUTH_STATE_JSON environment variable, for hosted Render deploys
 * 2. playwright/.auth/fieldroutes-state.json local file, for Mac/local development
 *
 * Status file: data/fieldroutes-auth-status.json
 */

import { promises as fs, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AUTH_STATE       = resolve(__dirname, '../../playwright/.auth/fieldroutes-state.json');
const STATUS_PATH      = resolve(__dirname, '../../data/fieldroutes-auth-status.json');
const FIELDROUTES_BASE = 'https://greenshieldpestsolutions.fieldroutes.com';

let _authStatus = {
  status:     'unknown',
  lastCheck:  null,
  message:    null,
};

let _keepaliveTimer = null;

export async function loadAuthStatus() {
  try {
    const raw = await fs.readFile(STATUS_PATH, 'utf8');
    const saved = JSON.parse(raw);
    _authStatus = {
      status:    saved.status    ?? 'unknown',
      lastCheck: saved.lastCheck ?? null,
      message:   saved.message   ?? null,
    };
    console.log(`[auth] Restored auth status from disk: ${_authStatus.status}`);
  } catch {
    _authStatus = { status: 'unknown', lastCheck: null, message: null };
  }
}

async function persistAuthStatus() {
  try {
    await fs.mkdir(resolve(__dirname, '../../data'), { recursive: true });
    await fs.writeFile(STATUS_PATH, JSON.stringify(_authStatus, null, 2));
  } catch (err) {
    console.warn('[auth] Could not persist auth status:', err.message);
  }
}

export function getAuthStatus() {
  return { ..._authStatus };
}

export function setAuthStatus(status, message = null) {
  _authStatus = {
    status,
    lastCheck: new Date().toISOString(),
    message,
  };
  persistAuthStatus();
}

async function readAuthState() {
  if (process.env.FIELDROUTES_AUTH_STATE_JSON) {
    try {
      return JSON.parse(process.env.FIELDROUTES_AUTH_STATE_JSON);
    } catch (err) {
      throw new Error(`FIELDROUTES_AUTH_STATE_JSON is not valid JSON: ${err.message}`);
    }
  }

  if (!existsSync(AUTH_STATE)) {
    return null;
  }

  const raw = await fs.readFile(AUTH_STATE, 'utf8');
  return JSON.parse(raw);
}

export async function checkAuthHealth() {
  let state;

  try {
    state = await readAuthState();
  } catch (err) {
    setAuthStatus('failed', err.message);
    return 'failed';
  }

  if (!state) {
    setAuthStatus('needs_login', 'Auth state not found — run the FieldRoutes login script locally and add FIELDROUTES_AUTH_STATE_JSON in Render.');
    return 'needs_login';
  }

  const cookieHeader = (state.cookies || [])
    .filter(c => (c.domain || '').includes('fieldroutes.com'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');

  if (!cookieHeader) {
    setAuthStatus('needs_login', 'No FieldRoutes session cookies found in auth state.');
    return 'needs_login';
  }

  try {
    const resp = await fetch(`${FIELDROUTES_BASE}/day.php`, {
      method: 'GET',
      headers: {
        Cookie:            cookieHeader,
        'User-Agent':      'Mozilla/5.0 (compatible; GreenShieldCRM/1.0)',
        Accept:            'text/html,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location') || '';
      const isLoginRedirect =
        loc === '/' ||
        loc === FIELDROUTES_BASE + '/' ||
        loc.includes('index.php') ||
        loc.includes('login');
      if (isLoginRedirect) {
        setAuthStatus('needs_login', 'FieldRoutes redirected to login — session expired.');
        return 'needs_login';
      }
      setAuthStatus('ok');
      return 'ok';
    }

    if (resp.status === 200) {
      let snippet = '';
      try {
        const reader = resp.body?.getReader();
        if (reader) {
          const { value } = await reader.read();
          reader.cancel().catch(() => {});
          snippet = new TextDecoder().decode(value?.slice(0, 6144) ?? new Uint8Array());
        } else {
          snippet = (await resp.text()).slice(0, 6144);
        }
      } catch { /* ignore body read errors */ }

      const isLoginPage =
        snippet.includes('name="password"') ||
        snippet.includes('type="password"') ||
        snippet.includes('id="loginForm"');

      if (isLoginPage) {
        setAuthStatus('needs_login', 'FieldRoutes returned the login page — session expired.');
        return 'needs_login';
      }

      setAuthStatus('ok');
      return 'ok';
    }

    const errStatus = resp.status >= 500 ? 'failed' : 'needs_login';
    setAuthStatus(errStatus, `FieldRoutes returned HTTP ${resp.status}`);
    return errStatus;

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const msg = isTimeout ? 'Auth health check timed out (12 s)' : `Network error: ${err.message}`;
    setAuthStatus('failed', msg);
    return 'failed';
  }
}

const DEFAULT_KEEPALIVE_MS = 45 * 60 * 1000;

export function startAuthKeepalive(intervalMs = DEFAULT_KEEPALIVE_MS) {
  if (_keepaliveTimer) return;
  const minutes = Math.round(intervalMs / 60000);
  console.log(`[auth] FieldRoutes session keepalive every ${minutes} min`);

  _keepaliveTimer = setInterval(async () => {
    if (_authStatus.status === 'needs_login') return;
    console.log('[auth] Keepalive: checking FieldRoutes session...');
    const result = await checkAuthHealth();
    console.log(`[auth] Keepalive result: ${result}`);
  }, intervalMs);

  if (_keepaliveTimer.unref) _keepaliveTimer.unref();
}

export function stopAuthKeepalive() {
  if (_keepaliveTimer) {
    clearInterval(_keepaliveTimer);
    _keepaliveTimer = null;
  }
}
