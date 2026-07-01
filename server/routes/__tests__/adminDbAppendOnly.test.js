import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  validateAppendOnlyDbEnablement: vi.fn(),
}));

vi.mock('../../repositories/backfill/appendOnlyDbEnablementValidation.js', () => ({
  validateAppendOnlyDbEnablement: mocks.validateAppendOnlyDbEnablement,
}));

import adminDbAppendOnlyRouter, { resetAdminDbAppendOnlyCacheForTests } from '../adminDbAppendOnly.js';

function createMockRes(resolve) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    getHeader(name) { return this.headers[name]; },
    json(body) { this.body = body; resolve(this); return this; },
    send(body) { this.body = body; resolve(this); return this; },
    end(body) { if (body !== undefined) this.body = body; resolve(this); return this; },
  };
}

function invokeRouter({ method = 'GET', url = '/append-only/validation', query = {}, currentUserContext = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      originalUrl: `/api/admin/db${url}`,
      path: url,
      headers: {},
      query,
      socket: { remoteAddress: '127.0.0.1' },
      currentUserContext,
    };
    const res = createMockRes(resolve);
    adminDbAppendOnlyRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

const adminContext = {
  userId: 'u-admin', role: 'admin', status: 'active', isAdmin: true,
};
const repContext = {
  userId: 'u-rep', role: 'sales_rep', status: 'active', isAdmin: false,
};

const PASS_RESULT = {
  status: 'pass',
  checks: [
    { name: 'database_configured', status: 'pass', message: 'DATABASE_URL is configured.', details: { configured: true, redactedDatabaseUrl: 'postgres://***:***@db.example.invalid:5432/staging' } },
    { name: 'database_health', status: 'pass', message: 'ok', details: { durationMs: 4 } },
    { name: 'migration_files_present', status: 'pass', message: 'present', details: {} },
    { name: 'migration_status', status: 'pass', message: 'applied', details: {} },
    { name: 'feature_flags', status: 'pass', message: 'safe', details: { flags: { dbWriteAIUsageEnabled: false, dbReadAIUsageEnabled: false, dbWriteErrorLogEnabled: false, dbReadErrorLogEnabled: false } } },
    { name: 'backfill_tooling_present', status: 'pass', message: 'present', details: {} },
    { name: 'documentation_present', status: 'pass', message: 'present', details: {} },
  ],
  recommendedCommands: ['npm run db:validate:append-only --prefix server'],
};

describe('admin route — GET /api/admin/db/append-only/validation', () => {
  beforeEach(() => {
    mocks.validateAppendOnlyDbEnablement.mockReset();
    resetAdminDbAppendOnlyCacheForTests();
  });
  afterEach(() => {
    resetAdminDbAppendOnlyCacheForTests();
    vi.restoreAllMocks();
  });

  it('returns 401 AUTH_REQUIRED when no current user context is attached', async () => {
    const res = await invokeRouter({ currentUserContext: null });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    expect(mocks.validateAppendOnlyDbEnablement).not.toHaveBeenCalled();
  });

  it('returns 403 ADMIN_REQUIRED for an authenticated non-admin user', async () => {
    const res = await invokeRouter({ currentUserContext: repContext });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required.', code: 'ADMIN_REQUIRED' });
    expect(mocks.validateAppendOnlyDbEnablement).not.toHaveBeenCalled();
  });

  it('returns 403 USER_INACTIVE for an inactive admin', async () => {
    const res = await invokeRouter({ currentUserContext: { ...adminContext, status: 'inactive' } });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    expect(mocks.validateAppendOnlyDbEnablement).not.toHaveBeenCalled();
  });

  it('returns the sanitized validation result for an admin', async () => {
    mocks.validateAppendOnlyDbEnablement.mockResolvedValue(PASS_RESULT);
    const res = await invokeRouter({ currentUserContext: adminContext });

    expect(res.statusCode).toBe(200);
    expect(mocks.validateAppendOnlyDbEnablement).toHaveBeenCalledTimes(1);
    expect(res.body.source).toBe('append_only_db_enablement_validation');
    expect(res.body.validation).toEqual(PASS_RESULT);
    expect(res.body.cache).toEqual({
      cached: false,
      cacheTtlSeconds: 30,
      cachedAt: expect.any(String),
    });
    expect(typeof res.body.generatedAt).toBe('string');
  });

  it('does not expose DATABASE_URL credentials, secrets, or raw log content', async () => {
    mocks.validateAppendOnlyDbEnablement.mockResolvedValue(PASS_RESULT);
    const res = await invokeRouter({ currentUserContext: adminContext });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/postgres:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]+/);
    expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{8,}/);
    expect(serialized).not.toContain('ANTHROPIC_API_KEY=');
    expect(serialized).not.toContain('OPENAI_API_KEY=');
    expect(serialized).not.toMatch(/"prompt"\s*:/i);
    expect(serialized).not.toMatch(/"messages"\s*:/i);
    expect(serialized).not.toMatch(/"transcript"\s*:/i);
  });

  it('serves a cached response on the second admin call within the TTL window', async () => {
    mocks.validateAppendOnlyDbEnablement.mockResolvedValue(PASS_RESULT);
    const first = await invokeRouter({ currentUserContext: adminContext });
    expect(first.body.cache.cached).toBe(false);

    const second = await invokeRouter({ currentUserContext: adminContext });
    expect(second.body.cache.cached).toBe(true);
    expect(mocks.validateAppendOnlyDbEnablement).toHaveBeenCalledTimes(1);
    expect(second.body.validation).toEqual(PASS_RESULT);
  });

  it('bypasses the cache when ?refresh=true is set', async () => {
    mocks.validateAppendOnlyDbEnablement.mockResolvedValue(PASS_RESULT);
    await invokeRouter({ currentUserContext: adminContext });
    await invokeRouter({ currentUserContext: adminContext });
    expect(mocks.validateAppendOnlyDbEnablement).toHaveBeenCalledTimes(1);

    const refreshed = await invokeRouter({ currentUserContext: adminContext, query: { refresh: 'true' } });
    expect(refreshed.body.cache.cached).toBe(false);
    expect(mocks.validateAppendOnlyDbEnablement).toHaveBeenCalledTimes(2);
  });

  it('returns 500 with a controlled error code when the validator throws', async () => {
    mocks.validateAppendOnlyDbEnablement.mockRejectedValue(new Error('boom'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await invokeRouter({ currentUserContext: adminContext });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: 'Failed to read append-only DB validation.',
      code: 'APPEND_ONLY_VALIDATION_READ_FAILED',
    });
    errorSpy.mockRestore();
  });

  it('the route does not import migrations, backfill apply, reconcile, or feature-flag mutation helpers', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const routeSrc = fs.readFileSync(path.join(here, '..', 'adminDbAppendOnly.js'), 'utf-8');

    expect(routeSrc).not.toContain('runPendingMigrations');
    expect(routeSrc).not.toContain('backfillAppendOnlyLogs');
    expect(routeSrc).not.toContain('reconcileAppendOnlyLogs');
    expect(routeSrc).not.toContain("'../currentStores/");
    expect(routeSrc).not.toContain("'../postgres/");
    expect(routeSrc).not.toContain('writeAppendOnlyDbEnablementReport');
    expect(routeSrc).not.toContain('DB_WRITE_AI_USAGE_ENABLED=true');
    expect(routeSrc).not.toContain('DB_WRITE_ERROR_LOG_ENABLED=true');
  });
});
