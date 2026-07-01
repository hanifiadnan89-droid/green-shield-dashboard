import { describe, expect, it, vi } from 'vitest';
import { createRepositories } from '../repositoryRegistry.js';

function aiUsageRepo(name) {
  return {
    name,
    recordUsage: vi.fn((entry) => ({ id: name, ...entry })),
    listUsage: vi.fn(() => [{ id: name }]),
    summarizeUsage: vi.fn(() => ({ total: 1 })),
    getStorageStatus: vi.fn(() => ({ backend: name })),
  };
}

function errorLogRepo(name) {
  return {
    name,
    createError: vi.fn((entry) => ({ id: name, ...entry })),
    listErrors: vi.fn(() => ({ errors: [{ id: name }], total: 1 })),
    getErrorById: vi.fn(() => ({ id: name })),
    updateErrorStatus: vi.fn(() => ({ status: 'ignored' })),
    markResolved: vi.fn(() => ({ status: 'resolved' })),
    archive: vi.fn(() => ({ status: 'archived' })),
    summarizeErrors: vi.fn(() => ({ total: 1 })),
    findSimilarErrors: vi.fn(() => []),
    setErrorAnalysis: vi.fn(() => ({ aiAnalysis: {} })),
    getStorageStatus: vi.fn(() => ({ backend: name })),
  };
}

describe('repository registry Stage 30 behavior', () => {
  it('returns current-store repositories by default', () => {
    const currentAI = aiUsageRepo('current-ai');
    const currentError = errorLogRepo('current-error');
    const postgresAI = aiUsageRepo('postgres-ai');
    const postgresError = errorLogRepo('postgres-error');
    const repositories = createRepositories({
      env: {},
      aiUsageCurrent: currentAI,
      aiUsagePostgres: postgresAI,
      errorLogCurrent: currentError,
      errorLogPostgres: postgresError,
    });

    repositories.aiUsage.recordUsage({ feature: 'test' });
    repositories.errorLog.createError({ message: 'boom' });

    expect(currentAI.recordUsage).toHaveBeenCalledTimes(1);
    expect(postgresAI.recordUsage).not.toHaveBeenCalled();
    expect(currentError.createError).toHaveBeenCalledTimes(1);
    expect(postgresError.createError).not.toHaveBeenCalled();
  });

  it('returns dual-write repositories when DB write flags are enabled', async () => {
    const currentAI = aiUsageRepo('current-ai');
    const postgresAI = aiUsageRepo('postgres-ai');
    const currentError = errorLogRepo('current-error');
    const postgresError = errorLogRepo('postgres-error');
    const repositories = createRepositories({
      env: {
        DB_WRITE_AI_USAGE_ENABLED: 'true',
        DB_WRITE_ERROR_LOG_ENABLED: 'true',
      },
      aiUsageCurrent: currentAI,
      aiUsagePostgres: postgresAI,
      errorLogCurrent: currentError,
      errorLogPostgres: postgresError,
    });

    await repositories.aiUsage.recordUsage({ feature: 'test' });
    await repositories.errorLog.createError({ message: 'boom' });

    expect(currentAI.recordUsage).toHaveBeenCalledTimes(1);
    expect(postgresAI.recordUsage).toHaveBeenCalledTimes(1);
    expect(currentError.createError).toHaveBeenCalledTimes(1);
    expect(postgresError.createError).toHaveBeenCalledTimes(1);
  });
});

