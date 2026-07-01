import { describe, expect, it, vi } from 'vitest';
import {
  createAIUsagePostgresRepository,
  normalizeUsageEntry,
} from '../postgres/aiUsagePostgresRepository.js';
import {
  createErrorLogPostgresRepository,
  normalizeErrorRecord,
} from '../postgres/errorLogPostgresRepository.js';

describe('append-only Postgres repositories', () => {
  it('AI usage adapter maps safe fields and uses parameterized SQL', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = createAIUsagePostgresRepository({ query, env: { DATABASE_URL: 'postgres://example/db' } });
    const entry = {
      id: 'ai_usage_1',
      timestamp: '2026-01-01T00:00:00.000Z',
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude',
      durationMs: 12.4,
      inputSize: 100,
      outputSize: 50,
      success: true,
      metadata: { deprecatedRoute: true },
      prompt: 'must not be persisted',
    };

    await repository.recordUsage(entry);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('$1');
    expect(sql).toContain('$17::jsonb');
    expect(sql).not.toContain('must not be persisted');
    expect(params).toContain('ai_usage_1');
    expect(params).toContain('assist-reply');
    expect(params).not.toContain('must not be persisted');
  });

  it('normalizes AI usage entries without prompt/raw response fields', () => {
    const normalized = normalizeUsageEntry({
      id: 'ai_usage_1',
      provider: 'anthropic',
      success: false,
      errorCode: 'RATE_LIMIT',
      metadata: { deprecatedRoute: true },
      raw: 'nope',
      messages: ['nope'],
    });

    expect(normalized).toMatchObject({
      id: 'ai_usage_1',
      provider: 'anthropic',
      success: false,
      errorCode: 'RATE_LIMIT',
    });
    expect(normalized).not.toHaveProperty('raw');
    expect(normalized).not.toHaveProperty('messages');
  });

  it('Error Center adapter maps safe fields and uses parameterized SQL', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = createErrorLogPostgresRepository({ query, env: { DATABASE_URL: 'postgres://example/db' } });
    const record = {
      id: 'err_1',
      timestamp: '2026-01-01T00:00:00.000Z',
      severity: 'high',
      status: 'new',
      source: 'backend',
      endpoint: 'GET /api/test',
      message: 'Safe message',
      rawMetadata: { source: 'test' },
      body: { password: 'must not be persisted' },
    };

    await repository.createError(record);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('$1');
    expect(sql).toContain('$24::jsonb');
    expect(sql).not.toContain('must not be persisted');
    expect(params).toContain('err_1');
    expect(params).toContain('Safe message');
    expect(params).not.toContain('must not be persisted');
  });

  it('normalizes Error Center records without raw request body fields', () => {
    const normalized = normalizeErrorRecord({
      id: 'err_1',
      severity: 'critical',
      message: 'Failure',
      body: { token: 'secret' },
      rawMetadata: { safe: true },
    });

    expect(normalized).toMatchObject({
      id: 'err_1',
      severity: 'critical',
      message: 'Failure',
    });
    expect(normalized).not.toHaveProperty('body');
    expect(normalized.rawMetadata).toBe(JSON.stringify({ safe: true }));
  });
});

