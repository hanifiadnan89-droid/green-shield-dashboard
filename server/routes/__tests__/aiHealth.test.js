import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAIProviderHealth: vi.fn(),
}));

vi.mock('../../services/ai/AIProviderHealthService.js', () => ({
  getAIProviderHealth: mocks.getAIProviderHealth,
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

function invokeRouter({ method = 'GET', url = '/health', currentUserContext = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      originalUrl: `/api/ai${url}`,
      path: url,
      headers: {},
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

describe('AI health route', () => {
  it('returns sanitized AI provider health for admin users', async () => {
    mocks.getAIProviderHealth.mockReset();
    mocks.getAIProviderHealth.mockReturnValue({
      status: 'degraded',
      generatedAt: '2026-06-29T00:00:00.000Z',
      providers: {
        anthropic: {
          configured: true,
          requiredEnv: 'ANTHROPIC_API_KEY',
          exposedSecret: false,
        },
        openai: {
          configured: false,
          requiredEnv: 'OPENAI_API_KEY',
          exposedSecret: false,
        },
      },
      capabilities: {
        chatGeneration: {
          configured: true,
          provider: 'anthropic',
          requiredEnv: 'ANTHROPIC_API_KEY',
          usedBy: ['Assist Reply'],
        },
      },
    });

    const res = await invokeRouter({ currentUserContext: adminContext });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.providers.anthropic.configured).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(mocks.getAIProviderHealth).toHaveBeenCalledTimes(1);
  });

  it('returns 403 ADMIN_REQUIRED for authenticated non-admin users', async () => {
    mocks.getAIProviderHealth.mockReset();

    const res = await invokeRouter({ currentUserContext: repContext });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required.', code: 'ADMIN_REQUIRED' });
    expect(mocks.getAIProviderHealth).not.toHaveBeenCalled();
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('ANTHROPIC_API_KEY');
  });

  it('returns 401 AUTH_REQUIRED when no current user context is attached', async () => {
    mocks.getAIProviderHealth.mockReset();

    const res = await invokeRouter({ currentUserContext: null });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    expect(mocks.getAIProviderHealth).not.toHaveBeenCalled();
  });
});
