import { describe, expect, it, vi } from 'vitest';
import {
  backfillAIUsageLogs,
  backfillAppendOnlyLogs,
  backfillErrorLogs,
} from '../backfill/appendOnlyLogBackfill.js';

function aiCurrent(entries) {
  return {
    listUsage: vi.fn(() => entries),
  };
}

function errorCurrent(entries) {
  return {
    listErrors: vi.fn(() => ({ errors: entries, total: entries.length })),
  };
}

describe('append-only log backfill', () => {
  it('dry-run AI usage backfill reads current store but does not write Postgres', async () => {
    const current = aiCurrent([{ id: 'ai_1' }, { id: 'ai_2' }]);
    const postgres = { recordUsage: vi.fn() };

    const summary = await backfillAIUsageLogs({
      currentAIUsageRepository: current,
      postgresAIUsageRepository: postgres,
      dryRun: true,
    });

    expect(summary).toMatchObject({
      domain: 'ai_usage',
      read: 2,
      attempted: 0,
      written: 0,
      skipped: 2,
      dryRun: true,
    });
    expect(current.listUsage).toHaveBeenCalledWith({ limit: 500 });
    expect(postgres.recordUsage).not.toHaveBeenCalled();
  });

  it('apply AI usage backfill writes Postgres records', async () => {
    const current = aiCurrent([{ id: 'ai_1' }, { id: 'ai_2' }]);
    const postgres = { recordUsage: vi.fn(async () => ({})) };

    const summary = await backfillAIUsageLogs({
      currentAIUsageRepository: current,
      postgresAIUsageRepository: postgres,
      dryRun: false,
    });

    expect(summary).toMatchObject({
      read: 2,
      attempted: 2,
      written: 2,
      failed: 0,
      dryRun: false,
    });
    expect(postgres.recordUsage).toHaveBeenCalledTimes(2);
  });

  it('records failures without stopping the full backfill unless strict', async () => {
    const current = aiCurrent([{ id: 'ai_1' }, { id: 'ai_2' }]);
    const postgres = {
      recordUsage: vi.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(Object.assign(new Error('db down'), { code: 'ECONNREFUSED' })),
    };

    const summary = await backfillAIUsageLogs({
      currentAIUsageRepository: current,
      postgresAIUsageRepository: postgres,
      dryRun: false,
    });

    expect(summary.written).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0]).toMatchObject({ id: 'ai_2', code: 'ECONNREFUSED' });

    await expect(backfillAIUsageLogs({
      currentAIUsageRepository: current,
      postgresAIUsageRepository: {
        recordUsage: vi.fn().mockRejectedValue(new Error('strict fail')),
      },
      dryRun: false,
      strict: true,
    })).rejects.toMatchObject({ code: 'APPEND_ONLY_BACKFILL_FAILED' });
  });

  it('dry-run Error Center backfill returns the expected summary', async () => {
    const current = errorCurrent([{ id: 'err_1' }]);
    const postgres = { createError: vi.fn() };

    const summary = await backfillErrorLogs({
      currentErrorLogRepository: current,
      postgresErrorLogRepository: postgres,
      dryRun: true,
      limit: 10,
    });

    expect(summary).toMatchObject({
      domain: 'error_log',
      read: 1,
      skipped: 1,
      dryRun: true,
    });
    expect(current.listErrors).toHaveBeenCalledWith({ limit: 10, includeArchived: true });
    expect(postgres.createError).not.toHaveBeenCalled();
  });

  it('combined backfill can target both append-only domains', async () => {
    const result = await backfillAppendOnlyLogs({
      domain: 'all',
      currentAIUsageRepository: aiCurrent([{ id: 'ai_1' }]),
      postgresAIUsageRepository: { recordUsage: vi.fn() },
      currentErrorLogRepository: errorCurrent([{ id: 'err_1' }]),
      postgresErrorLogRepository: { createError: vi.fn() },
      dryRun: true,
    });

    expect(result.summaries.map((summary) => summary.domain)).toEqual(['ai_usage', 'error_log']);
  });
});

