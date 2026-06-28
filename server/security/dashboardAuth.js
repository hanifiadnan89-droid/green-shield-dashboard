import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'gs_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const TOKEN_VERSION = 'v1';

function getSigningKey() {
  const password = process.env.DASHBOARD_PASSWORD || '';
  const username = process.env.DASHBOARD_USERNAME || '';
  const explicit = process.env.SESSION_SECRET || '';
  return crypto
    .createHash('sha256')
    .update(`gs-session:${TOKEN_VERSION}:${explicit}:${username}:${password}`)
    .digest();
}

function b64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function signSession(username) {
  const payload = { u: username, iat: Date.now() };
  const payloadStr = b64UrlEncode(JSON.stringify(payload));
  const sig = b64UrlEncode(crypto.createHmac('sha256', getSigningKey()).update(payloadStr).digest());
  return `${payloadStr}.${sig}`;
}

export function verifySession(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadStr, sig] = token.split('.');
  if (!payloadStr || !sig) return null;

  const expected = crypto.createHmac('sha256', getSigningKey()).update(payloadStr).digest();
  let received;
  try {
    received = b64UrlDecode(sig);
  } catch {
    return null;
  }
  if (received.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(received, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(b64UrlDecode(payloadStr).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.iat !== 'number') return null;
  if (Date.now() - payload.iat > SESSION_TTL_MS) return null;
  if (payload.u !== process.env.DASHBOARD_USERNAME) return null;
  return payload;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

function timingSafeStringEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    // Still compare to keep timing constant against the longer input.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export function checkCredentials(username, password) {
  const expectedUsername = process.env.DASHBOARD_USERNAME || '';
  const expectedPassword = process.env.DASHBOARD_PASSWORD || '';
  if (!expectedUsername || !expectedPassword) return false;
  const userOk = timingSafeStringEqual(username, expectedUsername);
  const passOk = timingSafeStringEqual(password, expectedPassword);
  return userOk && passOk;
}

function buildCookie(value, { maxAgeSeconds, secure }) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (maxAgeSeconds === 0) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  } else {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function setSessionCookie(req, res, token) {
  const secure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', buildCookie(token, { maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000), secure }));
}

export function clearSessionCookie(req, res) {
  const secure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', buildCookie('', { maxAgeSeconds: 0, secure }));
}

export function isAuthenticatedRequest(req) {
  if (getSessionFromRequest(req)) return true;

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  return checkCredentials(decoded.slice(0, idx), decoded.slice(idx + 1));
}

/**
 * Dashboard auth middleware.
 * Accepts a signed session cookie (set by POST /api/auth/login) OR HTTP Basic
 * Auth (kept so scripts/curl can still call the API directly).
 *
 * Rejects with 401 JSON for /api/* routes. No WWW-Authenticate header is sent
 * for those, so browsers don't open the native Basic Auth prompt — the React
 * LoginPage handles the credential entry UX.
 */
export function requireDashboardLogin(req, res, next) {
  const expectedUsername = process.env.DASHBOARD_USERNAME;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  // Startup validation guarantees both credentials are present before Express starts.
  if (!expectedUsername || !expectedPassword) {
    return next();
  }

  if (isAuthenticatedRequest(req)) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  // Non-API requests should be handled by the SPA catch-all (served pre-auth)
  // so the React LoginPage can render. Fall through to 401 for unexpected paths.
  return res.status(401).send('Authentication required');
}
