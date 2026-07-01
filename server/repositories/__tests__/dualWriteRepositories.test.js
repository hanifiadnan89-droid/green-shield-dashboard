import { describe, expect, it, vi } from 'vitest';
import { createAIUsageDualWriteRepository } from '../dualWrite/aiUsageDualWriteRepository.js';
import { createErrorLogDualWriteRepository } from '../dualWrite/errorLogDualWriteRepository.js';

function createAIUsageCurrent() {
  return {
    recordUsage: vi.fn(async (entry) => ({ id: 'ai_usage_1', ...entry })),
    listUsage: vi.fn(() => [{ id: 'current' }]),
    summarizeUsage: vi.fn(() => ({ total: 1 })),
    getStorageStatus: vi.fn(() => ({ backend: 'file' })),
  };
}

function createAIUsagePostgres() {
  return {
    recordUsage: vi.fn(async (entry) => ({ id: entry.id })),
    listUsage: vi.fn(() => [{ id: 'postgres' }]),
    summarizeUsage: vi.fn(() => ({ total: 2 })),
    getStorageStatus: vi.fn(() => ({ backend: 'postgres' })),
  };
}

function createErrorCurrent() {
  return {
    createError: vi.fn(async (entry) => ({ id: 'err_1', ...entry })),
    listErrors: vi.fn(() => ({ errors: [{ id: 'current' }], total: 1 })),
    getErrorById: vi.fn(() => ({ id: 'current' })),
    updateErrorStatus: vi.fn(() => ({ status: 'ignored' })),
    markResolved: vi.fn(() => ({ status: 'resolved' })),
    archive: vi.fn(() => ({ status: 'archived' })),
    summarizeErrors: vi.fn(() => ({ total: 1 })),
    findSimilarErrors: vi.fn(() => []),
    setErrorAnalysis: vi.fn(() => ({ aiAnalysis: {} })),
    getStorageStatus: vi.fn(() => ({ backend: 'file' })),
  };
}

function createErrorPostgres() {
  return {
    createError: vi.fn(async (entry) => ({ id: entry.id })),
    listErrors: vi.fn(() => ({ errors: [{ id: 'postgres' }], total: 1 })),
    getErrorById: vi.fn(() => ({ id: 'postgres' })),
    updateErrorStatus: vi.fn(() => ({ status: 'ignored' })),
    markResolved: vi.fn(() => ({ status: 'resolved' })),
    archive: vi.fn(() => ({ status: 'archived' })),
    summarizeErrors: vi.fn(() => ({ total: 2 })),
    findSimilarErrors: vi.fn(() => []),
    setErrorAnalysis: vi.fn(() => ({ aiAnalysis: {} })),
    getStorageStatus: vi.fn(() => ({ backend: 'postgres' })),
  };
}

describe('dual-write repositories', () => {
  it('AI usage flags off calls current-store only', async () => {
    const current = createAIUsageCurrent();
    const postgres = createAIUsagePostgres();
    const repository = createAIUsageDualWriteRepository({
      currentRepository: current,
      postgresRepository: postgres,
      env: {},
    });

    const result = await repository.recordUsage({ feature: 'test' });

    expect(result).toMatchObject({ id: 'ai_usage_1', feature: 'test' });
    expect(current.recordUsage).toHaveBeenCalledTimes(1);
    expect(postgres.recordUsage).not.toHaveBeenCalled();
  });

  it('AI usage write flag calls current-store first then Postgres', async () => {
    const current = createAIUsageCurrent();
    const postgres = createAIUsagePostgres();
    const repository = createAIUsageDualWriteRepository({
      currentRepository: current,
      postgresRepository: postgres,
      env: { DB_WRITE_AI_USAGE_ENABLED: 'true' },
    });

    await repository.recordUsage({ feature: 'test' });

    expect(current.recordUsage).toHaveBeenCalledTimes(1);
    expect(postgres.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ id: 'ai_usage_1' }));
    expect(current.recordUsage.mock.invocationCallOrder[0]).toBeLessThan(
      postgres.recordUsage.mock.invocationCallOrder[0],
    );
  });

  it('AI usage Postgres failure does not break current-store result', async () => {
    const current = createAIUsageCurrent();
    const postgres = createAIUsagePostgres();
    const logger = { warn: vi.fn() };
    postgres.recordUsage.mockRejectedValueOnce(Object.assign(new Error('db down'), { code: 'ECONNREFUSED' }));
    const repository = createAIUsageDualWriteRepository({
      currentRepository: current,
      postgresRepository: postgres,
      env: { DB_WRITE_AI_USAGE_ENABLED: 'true' },
      logger,
    });

    await expect(repository.recordUsage({ feature: 'test' }))
      .resolves.toMatchObject({ id: 'ai_usage_1' });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DB_DUAL_WRITE_AI_USAGE_FAILED'));
  });

  it('Error Center flags off calls current-store only', async () => {
    const current = createErrorCurrent();
    const postgres = createErrorPostgres();
    const repository = createErrorLogDualWriteRepository({
      currentRepository: current,
      postgresRepository: postgres,
      env: {},
    });

    await repository.createError({ message: 'boom' });

    expect(current.createError).toHaveBeenCalledTimes(1);
    expect(postgres.createError).not.toHaveBeenCalled();
  });

  it('Error Center write flag calls current-store first then Postgres', async () => {
    const current = createErrorCurrent();
    const postgres = createErrorPostgres();
    const repository = createErrorLogDualWriteRepository({
      currentRepository: current,
      postgresRepository: postgres,
      env: { DB_WRITE_ERROR_LOG_ENABLED: 'yes' },
    });

    await repository.createError({ message: 'boom' });

    expect(current.createError).toHaveBeenCalledTimes(1);
    expect(postgres.createError).toHaveBeenCalledWith(expect.objectContaining({ id: 'err_1' }));
    expect(current.createError.mock.invocationCallOrder[0]).toBeLessThan(
      postgres.createError.mock.invocationCallOrder[0],
    );
  });

  it('Error Center Postgres failure does not break current-store result', async () => {
    const current = createErrorCurrent();
    const postgres = createErrorPostgres();
    const logger = { warn: vi.fn() };
    postgres.createError.mockRejectedValueOnce(Object.assign(new Error('db down'), { code: 'ECONNREFUSED' }));
    const repository = createErrorLogDualWriteRepository({
      currentRepository: current,
      postgresRepository: postgres,
      env: { DB_WRITE_ERROR_LOG_ENABLED: 'true' },
      logger,
    });

    await expect(repository.createError({ message: 'boom' })).resolves.toMatchObject({ id: 'err_1' });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DB_DUAL_WRITE_ERROR_LOG_FAILED'));
  });
});

