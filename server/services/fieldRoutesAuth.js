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
 * Auth state sources (first match wins):
 * 1. data/fieldroutes-storage-state.json — pasted via dashboard or headless login (no redeploy)
 * 2. FIELDROUTES_AUTH_STATE_JSON environment variable (optional bootstrap on Render)
 * 3. playwright/.auth/fieldroutes-state.json — local Mac development
 *
 * Status file: data/fieldroutes-auth-status.json
 */

import { promises as fs, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AUTH_STATE         = resolve(__dirname, '../../playwright/.auth/fieldroutes-state.json');
const PERSISTED_STATE    = resolve(__dirname, '../../data/fieldroutes-storage-state.json');
const STATUS_PATH        = resolve(__dirname, '../../data/fieldroutes-auth-status.json');
const DEFAULT_FIELDROUTES_BASE = 'https://greenshieldpestsolutions.fieldroutes.com';

export function getFieldRoutesBaseUrl() {
  return (process.env.FIELDROUTES_BASE_URL || DEFAULT_FIELDROUTES_BASE).replace(/\/$/, '');
}

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

  if (process.env.RENDER && (process.env.FIELDROUTES_AUTH_STATE_JSON || '').trim()) {
    _authStatus = {
      status: 'checking',
      lastCheck: null,
      message: 'Validating FIELDROUTES_AUTH_STATE_JSON after deploy…',
    };
    console.log('[auth] Render: env auth JSON present — will re-validate on startup check');
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

export function getAuthStateSource() {
  if (existsSync(PERSISTED_STATE)) return 'persisted';
  const envRaw = (process.env.FIELDROUTES_AUTH_STATE_JSON || '').trim();
  if (envRaw) return 'env';
  if (existsSync(AUTH_STATE)) return 'file';
  return 'none';
}

function validateAuthStateShape(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('Auth state must be a JSON object with cookies.');
  }
  const summary = summarizeAuthState(state);
  if (summary.fieldRoutesCookieCount === 0) {
    throw new Error('No FieldRoutes cookies in auth state — log in again before exporting.');
  }
  return state;
}

export async function savePersistedAuthState(state) {
  validateAuthStateShape(state);
  await fs.mkdir(resolve(__dirname, '../../data'), { recursive: true });
  await fs.writeFile(PERSISTED_STATE, JSON.stringify(state));
  console.log(`[auth] Saved session to ${PERSISTED_STATE} (${summarizeAuthState(state).fieldRoutesCookieCount} FieldRoutes cookies)`);
  return state;
}

export async function getPlaywrightStorageState() {
  const state = await readAuthState();
  if (!state) {
    throw new Error('needs_login: FieldRoutes auth state not found');
  }
  return state;
}

function summarizeAuthState(state) {
  if (!state || typeof state !== 'object') {
    return { cookieCount: 0, fieldRoutesCookieCount: 0, originCount: 0, cookieNames: [] };
  }
  const cookies = Array.isArray(state.cookies) ? state.cookies : [];
  const fieldRoutesCookies = cookies.filter((c) => (c.domain || '').includes('fieldroutes.com'));
  return {
    cookieCount: cookies.length,
    fieldRoutesCookieCount: fieldRoutesCookies.length,
    originCount: Array.isArray(state.origins) ? state.origins.length : 0,
    cookieNames: fieldRoutesCookies.map((c) => c.name).filter(Boolean),
  };
}

function tryParseEnvAuthJson() {
  const envRaw = (process.env.FIELDROUTES_AUTH_STATE_JSON || '').trim();
  if (!envRaw) {
    return { raw: '', parsed: null, parseOk: false, parseError: null };
  }
  try {
    return { raw: envRaw, parsed: JSON.parse(envRaw), parseOk: true, parseError: null };
  } catch (err) {
    return { raw: envRaw, parsed: null, parseOk: false, parseError: err.message };
  }
}

export function getAuthConfigDiagnostics() {
  const env = tryParseEnvAuthJson();
  const fileExists = existsSync(AUTH_STATE);
  let fileParseOk = false;
  let fileParseError = null;
  let fileSummary = summarizeAuthState(null);

  if (fileExists) {
    try {
      const parsed = JSON.parse(readFileSync(AUTH_STATE, 'utf8'));
      fileParseOk = true;
      fileSummary = summarizeAuthState(parsed);
    } catch (err) {
      fileParseError = err.message;
    }
  }

  const source = getAuthStateSource();
  const persisted = getAuthStatus();

  let recommendation = null;
  const persistedExists = existsSync(PERSISTED_STATE);
  let persistedSummary = summarizeAuthState(null);
  if (persistedExists) {
    try {
      persistedSummary = summarizeAuthState(JSON.parse(readFileSync(PERSISTED_STATE, 'utf8')));
    } catch { /* ignore */ }
  }

  const credentialsConfigured = !!(
    (process.env.FIELDROUTES_USERNAME || '').trim()
    && (process.env.FIELDROUTES_PASSWORD || '').trim()
  );

  if (process.env.RENDER) {
    if (persisted.status === 'ok') {
      recommendation = 'Auth is healthy on this server.';
    } else if (credentialsConfigured) {
      recommendation = 'Session expired. Click “Refresh on server” (uses FIELDROUTES_USERNAME/PASSWORD) or paste exported JSON below — no Render redeploy needed.';
    } else if (!persistedExists && !env.raw) {
      recommendation = 'One-time setup: paste exported JSON below, OR set FIELDROUTES_USERNAME/PASSWORD for server refresh. Redeploy is not required after paste.';
    } else if (persisted.status === 'needs_login') {
      recommendation = 'Session expired. Paste fresh JSON from npm run fieldroutes:export-auth below, or use server credential refresh — no redeploy needed.';
    } else if (!env.parseOk && env.raw) {
      recommendation = 'FIELDROUTES_AUTH_STATE_JSON is invalid. Paste corrected JSON in the dashboard instead.';
    }
  } else if (source === 'none') {
    recommendation = 'Run: node scripts/fieldRoutesLogin.mjs (local) or set FIELDROUTES_AUTH_STATE_JSON (Render).';
  }

  return {
    deployTarget: process.env.RENDER ? 'render' : 'local',
    authSource: source,
    envVar: {
      configured: !!env.raw,
      length: env.raw.length,
      parseOk: env.parseOk,
      parseError: env.parseError,
      ...summarizeAuthState(env.parsed),
    },
    localFile: {
      path: 'playwright/.auth/fieldroutes-state.json',
      exists: fileExists,
      parseOk: fileParseOk,
      parseError: fileParseError,
      ...fileSummary,
    },
    serverPersisted: {
      path: 'data/fieldroutes-storage-state.json',
      exists: persistedExists,
      ...persistedSummary,
    },
    credentialsConfigured,
    persistedStatus: {
      status: persisted.status,
      lastCheck: persisted.lastCheck,
      message: persisted.message,
    },
    recommendation,
  };
}

export async function getAuthDiagnosticsWithHealthCheck() {
  const config = getAuthConfigDiagnostics();
  const result = await checkAuthHealth();
  const after = getAuthStatus();
  return {
    ...config,
    healthCheck: {
      result,
      status: after.status,
      lastCheck: after.lastCheck,
      message: after.message,
    },
    authSourceUsed: getAuthStateSource(),
  };
}

export async function readAuthState() {
  if (existsSync(PERSISTED_STATE)) {
    const raw = await fs.readFile(PERSISTED_STATE, 'utf8');
    return JSON.parse(raw);
  }

  const envRaw = (process.env.FIELDROUTES_AUTH_STATE_JSON || '').trim();
  if (envRaw) {
    try {
      return JSON.parse(envRaw);
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
  const source = getAuthStateSource();
  let state;

  try {
    state = await readAuthState();
  } catch (err) {
    console.error(`[auth] Health check failed (${source}): ${err.message}`);
    setAuthStatus('failed', err.message);
    return 'failed';
  }

  if (!state) {
    const msg = process.env.RENDER
      ? 'No FieldRoutes session on server. Paste exported JSON in Route Finder, set credentials for server refresh, or set FIELDROUTES_AUTH_STATE_JSON once.'
      : 'Auth state not found — run node scripts/fieldRoutesLogin.mjs locally.';
    console.warn(`[auth] Health check: no auth state (source=${source}, render=${!!process.env.RENDER})`);
    setAuthStatus('needs_login', msg);
    return 'needs_login';
  }

  const summary = summarizeAuthState(state);
  console.log(
    `[auth] Health check using source=${source} cookies=${summary.cookieCount} fieldRoutesCookies=${summary.fieldRoutesCookieCount}`,
  );

  const cookieHeader = (state.cookies || [])
    .filter(c => (c.domain || '').includes('fieldroutes.com'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');

  if (!cookieHeader) {
    setAuthStatus('needs_login', 'No FieldRoutes session cookies found in auth state.');
    return 'needs_login';
  }

  try {
    const resp = await fetch(`${getFieldRoutesBaseUrl()}/day.php`, {
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
        loc === getFieldRoutesBaseUrl() + '/' ||
        loc.includes('index.php') ||
        loc.includes('login');
      if (isLoginRedirect) {
        const msg = 'FieldRoutes session expired. Paste fresh JSON in Route Finder or use Refresh on server — no redeploy needed.';
        console.warn(`[auth] Health check: login redirect (source=${source})`);
        setAuthStatus('needs_login', msg);
        return 'needs_login';
      }
      console.log(`[auth] Health check: ok (source=${source})`);
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
        const msg = 'FieldRoutes session expired. Paste fresh JSON in Route Finder or use Refresh on server.';
        console.warn(`[auth] Health check: login page HTML (source=${source})`);
        setAuthStatus('needs_login', msg);
        return 'needs_login';
      }

      console.log(`[auth] Health check: ok (source=${source})`);
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
