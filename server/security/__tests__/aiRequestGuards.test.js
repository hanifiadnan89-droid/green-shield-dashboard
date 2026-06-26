import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AiHttpError,
  assertNonEmptyString,
  assertPromptWithinLimit,
  createAiRateLimiter,
  getConfiguredMaxTokens,
  runAiOperation,
  truncateAiText,
} from '../aiRequestGuards.js';
import { getAiMetricsSnapshot, resetAiMetricsForTest } from '../../services/aiOperationalMetrics.js';

function setEnv(name, value) {
  if (value == null) {
    delete process.env[name];
  } else {
    process.env[name] = String(value);
  }
}

function createRes() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetAiMetricsForTest();
  [
    'AI_RATE_LIMIT_MAX',
    'AI_RATE_LIMIT_WINDOW_MS',
    'AI_MAX_PROMPT_CHARS',
    'AI_MAX_RESPONSE_CHARS',
    'AI_TIMEOUT_MS',
    'AI_MAX_OUTPUT_TOKENS',
  ].forEach((name) => setEnv(name, null));
});

describe('aiRequestGuards', () => {
  it('rejects empty string fields and oversized prompts', () => {
    expect(() => assertNonEmptyString('   ', 'prompt')).toThrow(AiHttpError);

    setEnv('AI_MAX_PROMPT_CHARS', 5);
    expect(() => assertPromptWithinLimit('123456')).toThrow(AiHttpError);
  });

  it('caps response text and max output tokens', () => {
    setEnv('AI_MAX_RESPONSE_CHARS', 12);
    setEnv('AI_MAX_OUTPUT_TOKENS', 100);

    expect(truncateAiText('abcdefghijklmnopqrstuvwxyz')).toMatch(/\[truncated]$/);
    expect(getConfiguredMaxTokens(350)).toBe(100);
  });

  it('rate limits per authenticated user and emits metrics', () => {
    setEnv('AI_RATE_LIMIT_MAX', 1);
    setEnv('AI_RATE_LIMIT_WINDOW_MS', 60000);

    const limit = createAiRateLimiter();
    const auth = `Basic ${Buffer.from('adnan:secret').toString('base64')}`;
    const req = { headers: { authorization: auth }, originalUrl: '/api/ai/test', path: '/test', baseUrl: '/api/ai' };
    const firstRes = createRes();
    const secondRes = createRes();
    const next = vi.fn();

    limit(req, firstRes, next);
    limit(req, secondRes, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(secondRes.statusCode).toBe(429);
    expect(secondRes.headers['Retry-After']).toBe('60');
    expect(getAiMetricsSnapshot().counters.rateLimited).toBe(1);
  });

  it('records success metrics for completed provider operations', async () => {
    const result = await runAiOperation({
      endpoint: '/api/ai/test',
      module: 'test',
      provider: 'anthropic',
      model: 'test-model',
      promptLength: 10,
      operation: async () => ({ content: [{ text: 'ok' }] }),
    });

    expect(result.content[0].text).toBe('ok');
    expect(getAiMetricsSnapshot().counters.success).toBe(1);
  });

  it('turns abortable provider timeouts into HTTP 504 errors', async () => {
    setEnv('AI_TIMEOUT_MS', 5);

    await expect(runAiOperation({
      endpoint: '/api/ai/test',
      module: 'test',
      provider: 'anthropic',
      model: 'test-model',
      promptLength: 10,
      operation: ({ signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        setTimeout(() => resolve('late'), 100);
      }),
    })).rejects.toMatchObject({ status: 504, code: 'AI_TIMEOUT' });

    const snapshot = getAiMetricsSnapshot();
    expect(snapshot.counters.failure).toBe(1);
    expect(snapshot.counters.timeout).toBe(1);
  });
});
