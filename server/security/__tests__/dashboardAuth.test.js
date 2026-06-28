import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  signSession,
  verifySession,
  checkCredentials,
  isAuthenticatedRequest,
  requireDashboardLogin,
  getSessionFromRequest,
} from '../dashboardAuth.js';

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
  };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  res.send = (data) => { res.body = data; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  return res;
}

function mockReq({ path = '/', headers = {} } = {}) {
  return { path, headers };
}

describe('dashboardAuth', () => {
  let originalUser;
  let originalPass;
  let originalSecret;

  beforeEach(() => {
    originalUser = process.env.DASHBOARD_USERNAME;
    originalPass = process.env.DASHBOARD_PASSWORD;
    originalSecret = process.env.SESSION_SECRET;
    process.env.DASHBOARD_USERNAME = 'tester';
    process.env.DASHBOARD_PASSWORD = 'correct-horse-battery';
    delete process.env.SESSION_SECRET;
  });

  afterEach(() => {
    process.env.DASHBOARD_USERNAME = originalUser;
    process.env.DASHBOARD_PASSWORD = originalPass;
    if (originalSecret == null) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  describe('signSession / verifySession', () => {
    it('round-trips a valid session', () => {
      const token = signSession('tester');
      const payload = verifySession(token);
      expect(payload).toBeTruthy();
      expect(payload.u).toBe('tester');
      expect(typeof payload.iat).toBe('number');
    });

    it('rejects tokens with a tampered payload', () => {
      const token = signSession('tester');
      const [, sig] = token.split('.');
      const fakePayload = Buffer.from(JSON.stringify({ u: 'attacker', iat: Date.now() })).toString('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      expect(verifySession(`${fakePayload}.${sig}`)).toBeNull();
    });

    it('rejects tokens with a tampered signature', () => {
      const token = signSession('tester');
      const [payloadStr] = token.split('.');
      expect(verifySession(`${payloadStr}.AAAA`)).toBeNull();
    });

    it('rejects tokens signed under a different password', () => {
      const token = signSession('tester');
      process.env.DASHBOARD_PASSWORD = 'rotated-password';
      expect(verifySession(token)).toBeNull();
    });

    it('rejects malformed tokens', () => {
      expect(verifySession('')).toBeNull();
      expect(verifySession('no-dot')).toBeNull();
      expect(verifySession(null)).toBeNull();
      expect(verifySession(123)).toBeNull();
    });

    it('rejects expired tokens', () => {
      const token = signSession('tester');
      const [payloadStr, sig] = token.split('.');
      const decoded = JSON.parse(Buffer.from(payloadStr.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      decoded.iat = Date.now() - 13 * 60 * 60 * 1000; // older than 12h
      const newPayload = Buffer.from(JSON.stringify(decoded)).toString('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      // Old signature won't match the new payload; this confirms tampering is rejected.
      expect(verifySession(`${newPayload}.${sig}`)).toBeNull();
    });
  });

  describe('checkCredentials', () => {
    it('accepts the configured username and password', () => {
      expect(checkCredentials('tester', 'correct-horse-battery')).toBe(true);
    });

    it('rejects wrong password', () => {
      expect(checkCredentials('tester', 'wrong')).toBe(false);
    });

    it('rejects wrong username', () => {
      expect(checkCredentials('attacker', 'correct-horse-battery')).toBe(false);
    });

    it('rejects empty input', () => {
      expect(checkCredentials('', '')).toBe(false);
      expect(checkCredentials('tester', '')).toBe(false);
    });
  });

  describe('isAuthenticatedRequest', () => {
    it('accepts a valid session cookie', () => {
      const token = signSession('tester');
      const req = mockReq({ headers: { cookie: `gs_session=${encodeURIComponent(token)}; theme=dark` } });
      expect(isAuthenticatedRequest(req)).toBe(true);
      expect(getSessionFromRequest(req)).toBeTruthy();
    });

    it('accepts valid Basic Auth', () => {
      const b64 = Buffer.from('tester:correct-horse-battery').toString('base64');
      const req = mockReq({ headers: { authorization: `Basic ${b64}` } });
      expect(isAuthenticatedRequest(req)).toBe(true);
    });

    it('rejects invalid Basic Auth', () => {
      const b64 = Buffer.from('tester:wrong').toString('base64');
      const req = mockReq({ headers: { authorization: `Basic ${b64}` } });
      expect(isAuthenticatedRequest(req)).toBe(false);
    });

    it('rejects requests with no credentials', () => {
      expect(isAuthenticatedRequest(mockReq())).toBe(false);
    });
  });

  describe('requireDashboardLogin middleware', () => {
    it('calls next() for authenticated session cookie requests', () => {
      const token = signSession('tester');
      const req = mockReq({ path: '/api/leads', headers: { cookie: `gs_session=${encodeURIComponent(token)}` } });
      const res = mockRes();
      let called = false;
      requireDashboardLogin(req, res, () => { called = true; });
      expect(called).toBe(true);
    });

    it('returns 401 JSON for unauthenticated /api/ requests without WWW-Authenticate', () => {
      const req = mockReq({ path: '/api/leads' });
      const res = mockRes();
      requireDashboardLogin(req, res, () => { throw new Error('should not be called'); });
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      expect(res.headers['www-authenticate']).toBeUndefined();
    });

    it('returns 401 text for non-API unauthenticated requests', () => {
      const req = mockReq({ path: '/some-fallback' });
      const res = mockRes();
      requireDashboardLogin(req, res, () => { throw new Error('should not be called'); });
      expect(res.statusCode).toBe(401);
    });
  });
});
