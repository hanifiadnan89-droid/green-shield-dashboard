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
 * Auth state file (cookies): playwright/.auth/fieldroutes-state.json
 * Status file:               data/fieldroutes-auth-status.json
 * Both are gitignored — no credentials or session data are ever committed.
 */

import { promises as fs, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AUTH_STATE       = resolve(__dirname, '../../playwright/.auth/fieldroutes-state.json');
const STATUS_PATH      = resolve(__dirname, '../../data/fieldroutes-auth-status.json');
const FIELDROUTES_BASE = 'https://greenshieldpestsolutions.fieldroutes.com';
const AUTH_STATE_ENV   = 'FIELDROUTES_AUTH_STATE_JSON';

// ---------------------------------------------------------------------------
// In-memory auth status (fast reads, no file I/O on every status check)
// ---------------------------------------------------------------------------

let _authStatus = {
  status:     'unknown', // ok | needs_login | failed | unknown
  lastCheck:  null,      // ISO timestamp
  message:    null,
};

let _keepaliveTimer = null;

// ---------------------------------------------------------------------------
// Persistence — status file is gitignored via data/*.json
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public status accessors
// ---------------------------------------------------------------------------

export function getAuthStatus() {
  return { ..._authStatus };
}

export function setAuthStatus(status, message = null) {
  _authStatus = {
    status,
    lastCheck: new Date().toISOString(),
    message,
  };
  persistAuthStatus(); // fire-and-forget
}

function parseAuthStateJson(raw, sourceLabel) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${sourceLabel} is not valid JSON: ${err.message}`);
  }
}

export async function readFieldRoutesAuthState() {
  const envValue = process.env[AUTH_STATE_ENV];
  if (envValue?.trim()) {
    return parseAuthStateJson(envValue, AUTH_STATE_ENV);
  }

  if (!existsSync(AUTH_STATE)) {
    throw new Error('needs_login: FieldRoutes auth state not found.');
  }

  const raw = await fs.readFile(AUTH_STATE, 'utf8');
  return parseAuthStateJson(raw, AUTH_STATE);
}

export async function getFieldRoutesStorageStateForPlaywright() {
  if (process.env[AUTH_STATE_ENV]?.trim()) {
    return readFieldRoutesAuthState();
  }

  if (!existsSync(AUTH_STATE)) {
    throw new Error('needs_login: FieldRoutes auth state not found.');
  }

  return AUTH_STATE;
}

// ---------------------------------------------------------------------------
// Lightweight auth health check
// Uses raw HTTP fetch (no Playwright, no browser process).
// Reads cookies from the saved Playwright auth state and makes a single GET
// to day.php. Detects login redirects and login-page false-positives.
// Typically completes in 300–800 ms.
// ---------------------------------------------------------------------------

export async function checkAuthHealth() {
  let cookieHeader;
  try {
    const state = await readFieldRoutesAuthState();
    cookieHeader = (state.cookies || [])
      .filter(c => (c.domain || '').includes('fieldroutes.com'))
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
  } catch (err) {
    const msg = err.message || 'Cannot read FieldRoutes auth state.';
    if (msg.includes('needs_login')) {
      setAuthStatus('needs_login', 'Auth state not found — set FIELDROUTES_AUTH_STATE_JSON on Render or run the local login script.');
      return 'needs_login';
    }
    setAuthStatus('failed', `Cannot read auth state: ${msg}`);
    return 'failed';
  }

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
      redirect: 'manual',           // Do not follow redirects — inspect them directly
      signal: AbortSignal.timeout(12000),
    });

    // 3xx redirect — check destination to distinguish login redirect from date redirect
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
      // A redirect to another day.php URL or similar → auth is fine
      setAuthStatus('ok');
      return 'ok';
    }

    if (resp.status === 200) {
      // Read first 6 KB to detect login page returned with 200
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

    // 4xx / 5xx
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

// ---------------------------------------------------------------------------
// Session keepalive
// Runs every 45 minutes by default. Makes the same lightweight HTTP GET to
// day.php — this touches the PHP session on the FieldRoutes server and resets
// its idle timer, preventing garbage collection between route scrapes.
// Skips the check when auth is already known to need login (no point pinging).
// ---------------------------------------------------------------------------

const DEFAULT_KEEPALIVE_MS = 45 * 60 * 1000; // 45 minutes

export function startAuthKeepalive(intervalMs = DEFAULT_KEEPALIVE_MS) {
  if (_keepaliveTimer) return; // already running
  const minutes = Math.round(intervalMs / 60000);
  console.log(`[auth] FieldRoutes session keepalive every ${minutes} min`);

  _keepaliveTimer = setInterval(async () => {
    if (_authStatus.status === 'needs_login') {
      // No point pinging if we already know auth is expired
      return;
    }
    console.log('[auth] Keepalive: checking FieldRoutes session...');
    const result = await checkAuthHealth();
    console.log(`[auth] Keepalive result: ${result}`);
  }, intervalMs);

  // Let Node.js exit cleanly even if the timer is pending
  if (_keepaliveTimer.unref) _keepaliveTimer.unref();
}

export function stopAuthKeepalive() {
  if (_keepaliveTimer) {
    clearInterval(_keepaliveTimer);
    _keepaliveTimer = null;
  }
}
