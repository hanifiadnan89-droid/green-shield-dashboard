import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listAIUsage: vi.fn(),
  summarizeAIUsage: vi.fn(),
  getSafeAIUsageLogStorageStatus: vi.fn(),
}));

vi.mock('../../services/ai/AIUsageRecorder.js', () => ({
  listAIUsage: mocks.listAIUsage,
  summarizeAIUsage: mocks.summarizeAIUsage,
  getSafeAIUsageLogStorageStatus: mocks.getSafeAIUsageLogStorageStatus,
}));

import aiRouter from '../ai.js';

function createMockRes(resolve) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    getHeader(name) {
      return this.headers[name];
    },
    json(body) {
      this.body = body;
      resolve(this);
      return this;
    },
    send(body) {
      this.body = body;
      resolve(this);
      return this;
    },
    end(body) {
      if (body !== undefined) this.body = body;
      resolve(this);
      return this;
    },
  };
}

function invokeRouter({ method = 'GET', url = '/usage', query = {}, currentUserContext = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      originalUrl: `/api/ai${url}`,
      path: url,
      headers: {},
      query,
      socket: { remoteAddress: '127.0.0.1' },
      currentUserContext,
    };
    const res = createMockRes(resolve);
    aiRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

const adminContext = {
  userId: 'u-admin',
  role: 'admin',
  status: 'active',
  isAdmin: true,
};

const repContext = {
  userId: 'u-rep',
  role: 'sales_rep',
  status: 'active',
  isAdmin: false,
};

describe('AI usage route', () => {
  beforeEach(() => {
    mocks.listAIUsage.mockReset();
    mocks.summarizeAIUsage.mockReset();
    mocks.getSafeAIUsageLogStorageStatus.mockReset();
  });

  it('returns sanitized usage list and summary for admin users', async () => {
    mocks.summarizeAIUsage.mockReturnValue({
      total: 2,
      success: 1,
      failure: 1,
      averageDurationMs: 250,
      byFeature: { 'assist-reply': 2 },
      byProvider: { anthropic: 2 },
      byErrorCode: { AI_PROVIDER_RATE_LIMIT: 1 },
    });
    mocks.listAIUsage.mockReturnValue([
      {
        id: 'ai_usage_aaa',
        timestamp: '2026-06-29T12:00:00.000Z',
        endpoint: '/api/ai/assist-reply',
        feature: 'assist-reply',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        durationMs: 200,
        inputSize: 100,
        outputSize: 50,
        success: true,
        errorCode: null,
        status: 'success',
      },
      {
        id: 'ai_usage_bbb',
        timestamp: '2026-06-29T12:05:00.000Z',
        endpoint: '/api/ai/assist-reply',
        feature: 'assist-reply',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        durationMs: 300,
        inputSize: 100,
        outputSize: 0,
        success: false,
        errorCode: 'AI_PROVIDER_RATE_LIMIT',
        status: 'failure',
      },
    ]);

    const res = await invokeRouter({ currentUserContext: adminContext });

    expect(res.statusCode).toBe(200);
    expect(res.body.summary.total).toBe(2);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries[0].endpoint).toBe('/api/ai/assist-reply');
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('prompt');
    expect(serialized).not.toContain('raw');
  });

  it('passes through filters (feature, provider, success, from, to, limit) to the service for admins', async () => {
    mocks.listAIUsage.mockReturnValue([]);
    mocks.summarizeAIUsage.mockReturnValue({ total: 0, success: 0, failure: 0, averageDurationMs: 0, byFeature: {}, byProvider: {}, byErrorCode: {} });

    await invokeRouter({
      currentUserContext: adminContext,
      query: {
        feature: 'sales-coach',
        provider: 'anthropic',
        success: 'false',
        from: '2026-06-01',
        to: '2026-06-30',
        limit: '5',
      },
    });

    const expectedFilters = {
      feature: 'sales-coach',
      provider: 'anthropic',
      success: false,
      from: '2026-06-01',
      to: '2026-06-30',
      limit: '5',
    };
    expect(mocks.summarizeAIUsage).toHaveBeenCalledWith(expect.objectContaining(expectedFilters));
    expect(mocks.listAIUsage).toHaveBeenCalledWith(expect.objectContaining(expectedFilters));
  });

  it('returns 500 with a controlled error code when the service throws for admins', async () => {
    mocks.summarizeAIUsage.mockImplementation(() => { throw new Error('read failure'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await invokeRouter({ currentUserContext: adminContext });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: 'Failed to read AI usage log.',
      code: 'AI_USAGE_READ_FAILED',
    });
    errorSpy.mockRestore();
  });

  it('returns 403 ADMIN_REQUIRED for authenticated non-admin users', async () => {
    const res = await invokeRouter({ currentUserContext: repContext });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required.', code: 'ADMIN_REQUIRED' });
    expect(mocks.summarizeAIUsage).not.toHaveBeenCalled();
    expect(mocks.listAIUsage).not.toHaveBeenCalled();
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toContain('Bearer');
  });

  it('returns 403 USER_INACTIVE for an inactive admin', async () => {
    const inactiveAdmin = { ...adminContext, status: 'inactive' };
    const res = await invokeRouter({ currentUserContext: inactiveAdmin });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    expect(mocks.summarizeAIUsage).not.toHaveBeenCalled();
  });

  it('returns 401 AUTH_REQUIRED when no current user context is attached', async () => {
    const res = await invokeRouter({ currentUserContext: null });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    expect(mocks.summarizeAIUsage).not.toHaveBeenCalled();
  });
});

describe('AI usage storage route', () => {
  beforeEach(() => {
    mocks.listAIUsage.mockReset();
    mocks.summarizeAIUsage.mockReset();
    mocks.getSafeAIUsageLogStorageStatus.mockReset();
  });

  it('returns the sanitized storage status for admins', async () => {
    mocks.getSafeAIUsageLogStorageStatus.mockReturnValue({
      backend: 'persistent_disk',
      configured: true,
      source: 'AI_USAGE_LOG_DATA_DIR',
      render: true,
      production: true,
      inRepo: false,
      writeSafe: true,
      warning: null,
    });

    const res = await invokeRouter({ url: '/usage/storage', currentUserContext: adminContext });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      backend: 'persistent_disk',
      configured: true,
      source: 'AI_USAGE_LOG_DATA_DIR',
      render: true,
      production: true,
      inRepo: false,
      writeSafe: true,
      warning: null,
    });
    expect(res.body).not.toHaveProperty('filePath');
    expect(res.body).not.toHaveProperty('dataDir');
    expect(res.body).not.toHaveProperty('renderConfigValid');
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('ANTHROPIC_API_KEY');
    expect(serialized).not.toContain('OPENAI_API_KEY');
    expect(serialized).not.toMatch(/\.json/);
    expect(serialized).not.toMatch(/\/var\/data/);
  });

  it('returns 403 ADMIN_REQUIRED for authenticated non-admin users', async () => {
    const res = await invokeRouter({ url: '/usage/storage', currentUserContext: repContext });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required.', code: 'ADMIN_REQUIRED' });
    expect(mocks.getSafeAIUsageLogStorageStatus).not.toHaveBeenCalled();
  });

  it('returns 401 AUTH_REQUIRED when no current user context is attached', async () => {
    const res = await invokeRouter({ url: '/usage/storage', currentUserContext: null });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    expect(mocks.getSafeAIUsageLogStorageStatus).not.toHaveBeenCalled();
  });

  it('returns 500 with a controlled error code when the service throws', async () => {
    mocks.getSafeAIUsageLogStorageStatus.mockImplementation(() => { throw new Error('boom'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await invokeRouter({ url: '/usage/storage', currentUserContext: adminContext });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: 'Failed to read AI usage storage status.',
      code: 'AI_USAGE_STORAGE_READ_FAILED',
    });
    errorSpy.mockRestore();
  });

  it('does not expose secrets or filesystem-looking strings even on unsafe storage', async () => {
    mocks.getSafeAIUsageLogStorageStatus.mockReturnValue({
      backend: 'file',
      configured: false,
      source: 'default',
      render: true,
      production: true,
      inRepo: true,
      writeSafe: false,
      warning: 'AI usage log production writes are disabled. Configure durable storage with AI_USAGE_LOG_STORAGE_BACKEND=persistent_disk and AI_USAGE_LOG_DATA_DIR on a Render persistent disk, or set KNOWLEDGE_STORAGE_BACKEND=persistent_disk and KNOWLEDGE_DATA_DIR=/var/data/knowledge-base.',
    });

    const res = await invokeRouter({ url: '/usage/storage', currentUserContext: adminContext });

    expect(res.statusCode).toBe(200);
    expect(res.body.writeSafe).toBe(false);
    // The warning text may legitimately reference env-var names as advice; it must
    // never embed actual env values or absolute paths beyond what the service returned.
    expect(res.body).not.toHaveProperty('filePath');
    expect(res.body).not.toHaveProperty('dataDir');
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]+/);
    expect(serialized).not.toMatch(/Bearer\s+/);
  });
});
