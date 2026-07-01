import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runSalesCoachModule: vi.fn(),
}));

vi.mock('../../services/salesCoachEngine.js', () => ({
  runSalesCoachModule: mocks.runSalesCoachModule,
  getSupportedModules: () => ['objectionCoach'],
}));

// Minimal stubs for the other modules ai.js imports — none of them are exercised
// by the /coach-objection path, but the router file pulls them in.
vi.mock('../../services/knowledge.js', () => ({
  loadKnowledge: () => 'Knowledge base rules',
}));

vi.mock('../../services/objectionKnowledge.js', () => ({
  loadOAKnowledge: () => 'Objection knowledge',
  appendFeedback: vi.fn(),
  appendCase: vi.fn(),
  getRelevantExamplesWithFallback: vi.fn().mockResolvedValue([]),
  formatExamplesForPrompt: () => '',
}));

vi.mock('../../services/trainingService.js', () => ({
  listTrainingItems: vi.fn(),
  createTrainingItem: vi.fn(),
  updateTrainingItem: vi.fn(),
  deleteTrainingItem: vi.fn(),
  upsertSession: vi.fn(),
  listSessions: vi.fn(),
}));

import aiRouter from '../ai.js';

function createMockResponse() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      resolve(this);
      return this;
    },
  };
  return { res, done };
}

async function invokeCoachObjection({ body, context = null }) {
  const req = {
    method: 'POST',
    url: '/coach-objection',
    path: '/coach-objection',
    originalUrl: '/api/ai/coach-objection',
    baseUrl: '/api/ai',
    headers: {},
    body,
    currentUserContext: context,
    ip: '127.0.0.1',
  };
  const { res, done } = createMockResponse();
  await new Promise((resolve, reject) => {
    aiRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
    done.then(resolve).catch(reject);
  });
  return res;
}

describe('AI coach-objection compatibility route', () => {
  const adminContext = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runSalesCoachModule.mockResolvedValue({
      recommendedResponse: 'A spoken response.',
      salesAngle: 'Internal coaching note.',
      softerVersion: 'A softer alternative.',
      confidence: 0.8,
    });
  });

  it('returns the salesCoachEngine result body unchanged and forwards the original payload', async () => {
    const res = await invokeCoachObjection({
      context: adminContext,
      body: {
        mode: 'coachObjection',
        situation: 'Customer says it is too expensive.',
        category: 'price',
        service: 'IQ',
        personality: 'analytical',
        propertyContext: { customerName: 'Lead' },
        leadContext: { pricing: '$119' },
        sessionId: 'sess_abc',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      recommendedResponse: 'A spoken response.',
      salesAngle: 'Internal coaching note.',
      softerVersion: 'A softer alternative.',
      confidence: 0.8,
    });
    expect(mocks.runSalesCoachModule).toHaveBeenCalledTimes(1);
    const [moduleName, params, runtime] = mocks.runSalesCoachModule.mock.calls[0];
    expect(moduleName).toBe('objectionCoach');
    expect(params).toMatchObject({
      situation: 'Customer says it is too expensive.',
      category: 'price',
      service: 'IQ',
      personality: 'analytical',
      sessionId: 'sess_abc',
    });
    expect(runtime.endpoint).toBe('/api/ai/coach-objection');
    expect(runtime.usageMetadata).toEqual({
      deprecatedRoute: true,
      deprecatedPath: '/api/ai/coach-objection',
      replacementPath: '/api/ai/sales-coach/module',
    });
  });

  it('sets Deprecation and X-GreenShield-Replacement headers pointing to the active module endpoint', async () => {
    const res = await invokeCoachObjection({
      context: adminContext,
      body: {
        mode: 'coachObjection',
        situation: 'Customer hesitating',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers.Deprecation).toBe('true');
    expect(res.headers['X-GreenShield-Replacement']).toBe('/api/ai/sales-coach/module');
    const headerSerialized = JSON.stringify(res.headers);
    expect(headerSerialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(headerSerialized).not.toContain('Bearer');
    expect(headerSerialized).not.toContain('Customer hesitating');
  });

  it('still sets deprecation headers even on validation failures (400 mode mismatch)', async () => {
    const res = await invokeCoachObjection({
      context: adminContext,
      body: { mode: 'somethingElse', situation: 'irrelevant' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'mode must be "coachObjection"' });
    expect(res.headers.Deprecation).toBe('true');
    expect(res.headers['X-GreenShield-Replacement']).toBe('/api/ai/sales-coach/module');
    expect(mocks.runSalesCoachModule).not.toHaveBeenCalled();
  });

  it('returns controlled 401 when currentUserContext is missing — headers still set', async () => {
    const res = await invokeCoachObjection({
      body: { mode: 'coachObjection', situation: 'Anything' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    expect(res.headers.Deprecation).toBe('true');
    expect(res.headers['X-GreenShield-Replacement']).toBe('/api/ai/sales-coach/module');
    expect(mocks.runSalesCoachModule).not.toHaveBeenCalled();
  });
});
