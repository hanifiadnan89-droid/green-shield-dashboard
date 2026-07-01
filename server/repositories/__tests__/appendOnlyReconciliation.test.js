import { describe, expect, it } from 'vitest';
import {
  MAX_ID_DIFFS,
  reconcileAIUsageLogs,
  reconcileAppendOnlyLogs,
  reconcileErrorLogs,
} from '../backfill/appendOnlyLogReconciliation.js';

function aiRepo(entries) {
  return { listUsage: async () => entries };
}

function errorRepo(entries) {
  return { listErrors: async () => ({ errors: entries, total: entries.length }) };
}

describe('append-only log reconciliation', () => {
  it('passes when AI usage counts, ids, timestamps, and buckets match', async () => {
    const entries = [
      { id: 'ai_1', timestamp: '2026-01-01T00:00:00.000Z', provider: 'anthropic', feature: 'assist', success: true },
      { id: 'ai_2', timestamp: '2026-01-02T00:00:00.000Z', provider: 'openai', feature: 'embedding', success: false },
    ];

    const result = await reconcileAIUsageLogs({
      currentAIUsageRepository: aiRepo(entries),
      postgresAIUsageRepository: aiRepo([...entries].reverse()),
    });

    expect(result.matched).toBe(true);
    expect(result.checks).toMatchObject({
      totalCount: true,
      latestTimestamp: true,
      ids: true,
      byProvider: true,
      byFeature: true,
      bySuccess: true,
    });
  });

  it('fails when current ids are missing in Postgres', async () => {
    const result = await reconcileAIUsageLogs({
      currentAIUsageRepository: aiRepo([{ id: 'ai_1', timestamp: '2026-01-01T00:00:00.000Z' }]),
      postgresAIUsageRepository: aiRepo([]),
    });

    expect(result.matched).toBe(false);
    expect(result.missingIds).toEqual(['ai_1']);
    expect(result.checks.totalCount).toBe(false);
  });

  it('reports extra Postgres ids and caps id samples', async () => {
    const current = [];
    const postgres = Array.from({ length: MAX_ID_DIFFS + 10 }, (_, index) => ({
      id: `ai_extra_${index}`,
      timestamp: '2026-01-01T00:00:00.000Z',
    }));

    const result = await reconcileAIUsageLogs({
      currentAIUsageRepository: aiRepo(current),
      postgresAIUsageRepository: aiRepo(postgres),
    });

    expect(result.extraIds).toHaveLength(MAX_ID_DIFFS);
    expect(result.matched).toBe(false);
  });

  it('compares Error Center severity and status buckets', async () => {
    const current = [
      { id: 'err_1', timestamp: '2026-01-01T00:00:00.000Z', severity: 'high', status: 'new' },
      { id: 'err_2', timestamp: '2026-01-02T00:00:00.000Z', severity: 'low', status: 'resolved' },
    ];
    const postgres = [
      { id: 'err_1', timestamp: '2026-01-01T00:00:00.000Z', severity: 'high', status: 'new' },
      { id: 'err_2', timestamp: '2026-01-02T00:00:00.000Z', severity: 'low', status: 'resolved' },
    ];

    const result = await reconcileErrorLogs({
      currentErrorLogRepository: errorRepo(current),
      postgresErrorLogRepository: errorRepo(postgres),
    });

    expect(result.matched).toBe(true);
    expect(result.checks.bySeverity).toBe(true);
    expect(result.checks.byStatus).toBe(true);
  });

  it('combined reconciliation returns aggregate matched state', async () => {
    const result = await reconcileAppendOnlyLogs({
      domain: 'all',
      currentAIUsageRepository: aiRepo([{ id: 'ai_1' }]),
      postgresAIUsageRepository: aiRepo([{ id: 'ai_1' }]),
      currentErrorLogRepository: errorRepo([{ id: 'err_1' }]),
      postgresErrorLogRepository: errorRepo([]),
    });

    expect(result.matched).toBe(false);
    expect(result.results.map((item) => item.domain)).toEqual(['ai_usage', 'error_log']);
  });
});

