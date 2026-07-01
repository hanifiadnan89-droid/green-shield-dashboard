import { describe, expect, it, vi } from 'vitest';
import { createErrorLogRecorder } from '../errorLogRecorder.js';

function createCurrentService() {
  return {
    createError: vi.fn((entry) => ({ id: 'err_1', ...entry })),
    listErrors: vi.fn(() => ({ errors: [{ id: 'current' }], total: 1 })),
    getErrorDetail: vi.fn((id) => ({ id, source: 'current' })),
    updateErrorStatus: vi.fn((id, status) => ({ id, status })),
    markErrorResolved: vi.fn((id) => ({ id, status: 'resolved' })),
    archiveError: vi.fn((id) => ({ id, status: 'archived' })),
    summarizeErrors: vi.fn(() => ({ total: 1 })),
    findSimilarErrors: vi.fn(() => [{ id: 'similar_current' }]),
    setErrorAnalysis: vi.fn((id, analysis) => ({ id, aiAnalysis: analysis })),
    getErrorLogStorageStatus: vi.fn(() => ({ backend: 'file', writeSafe: true })),
    initializeErrorLogStorage: vi.fn(() => ({ backend: 'file' })),
  };
}

function createPostgresRepository() {
  return {
    createError: vi.fn(async (entry) => ({ id: entry.id })),
    listErrors: vi.fn(async () => ({ errors: [{ id: 'postgres' }], total: 1 })),
    getErrorById: vi.fn(async (id) => ({ id, source: 'postgres' })),
    updateErrorStatus: vi.fn(async (id, status) => ({ id, status })),
    markResolved: vi.fn(async (id) => ({ id, status: 'resolved' })),
    archive: vi.fn(async (id) => ({ id, status: 'archived' })),
    summarizeErrors: vi.fn(async () => ({ total: 2 })),
    findSimilarErrors: vi.fn(async () => [{ id: 'similar_postgres' }]),
    setErrorAnalysis: vi.fn(async (id, analysis) => ({ id, aiAnalysis: analysis })),
    getStorageStatus: vi.fn(() => ({ backend: 'postgres' })),
  };
}

async function flushBackgroundWork() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('errorLogRecorder', () => {
  it('flags off records directly to errorLogService only', async () => {
    const currentService = createCurrentService();
    const postgresFactory = vi.fn();
    const recorder = createErrorLogRecorder({
      currentService,
      postgresRepositoryFactory: postgresFactory,
      env: {},
    });

    const result = recorder.createError({ message: 'boom' });
    await flushBackgroundWork();

    expect(result).toMatchObject({ id: 'err_1', message: 'boom' });
    expect(currentService.createError).toHaveBeenCalledTimes(1);
    expect(postgresFactory).not.toHaveBeenCalled();
  });

  it('DB write flag records current store first, then Postgres', async () => {
    const currentService = createCurrentService();
    const postgres = createPostgresRepository();
    const recorder = createErrorLogRecorder({
      currentService,
      postgresRepositoryFactory: vi.fn(async () => postgres),
      env: { DB_WRITE_ERROR_LOG_ENABLED: 'true' },
    });

    const result = recorder.createError({ message: 'boom' });
    await flushBackgroundWork();

    expect(result).toMatchObject({ id: 'err_1' });
    expect(currentService.createError).toHaveBeenCalledTimes(1);
    expect(postgres.createError).toHaveBeenCalledWith(expect.objectContaining({ id: 'err_1' }));
  });

  it('Postgres write failure does not break current-store result or recurse into Error Center', async () => {
    const currentService = createCurrentService();
    const postgres = createPostgresRepository();
    const logger = { warn: vi.fn() };
    postgres.createError.mockRejectedValueOnce(Object.assign(new Error('db down'), { code: 'ECONNREFUSED' }));
    const recorder = createErrorLogRecorder({
      currentService,
      postgresRepositoryFactory: vi.fn(async () => postgres),
      env: { DB_WRITE_ERROR_LOG_ENABLED: 'true' },
      logger,
    });

    const result = recorder.createError({ message: 'boom' });
    await flushBackgroundWork();

    expect(result).toMatchObject({ id: 'err_1' });
    expect(currentService.createError).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DB_DUAL_WRITE_ERROR_LOG_FAILED'));
  });

  it('DB read flag off reads from current store', async () => {
    const currentService = createCurrentService();
    const postgresFactory = vi.fn();
    const recorder = createErrorLogRecorder({
      currentService,
      postgresRepositoryFactory: postgresFactory,
      env: {},
    });

    await expect(recorder.listErrors({ limit: 10 })).resolves.toEqual({ errors: [{ id: 'current' }], total: 1 });
    await expect(recorder.getErrorDetail('err_1')).resolves.toEqual({ id: 'err_1', source: 'current' });
    await expect(recorder.summarizeErrors()).resolves.toEqual({ total: 1 });
    await expect(recorder.findSimilarErrors('err_1')).resolves.toEqual([{ id: 'similar_current' }]);
    expect(postgresFactory).not.toHaveBeenCalled();
  });

  it('DB read flag on reads from Postgres repository', async () => {
    const currentService = createCurrentService();
    const postgres = createPostgresRepository();
    const recorder = createErrorLogRecorder({
      currentService,
      postgresRepositoryFactory: vi.fn(async () => postgres),
      env: { DB_READ_ERROR_LOG_ENABLED: 'true' },
    });

    await expect(recorder.listErrors({ limit: 10 })).resolves.toEqual({ errors: [{ id: 'postgres' }], total: 1 });
    await expect(recorder.getErrorDetail('err_1')).resolves.toEqual({ id: 'err_1', source: 'postgres' });
    await expect(recorder.summarizeErrors()).resolves.toEqual({ total: 2 });
    await expect(recorder.findSimilarErrors('err_1')).resolves.toEqual([{ id: 'similar_postgres' }]);
    expect(currentService.listErrors).not.toHaveBeenCalled();
    expect(currentService.getErrorDetail).not.toHaveBeenCalled();
    expect(currentService.summarizeErrors).not.toHaveBeenCalled();
    expect(currentService.findSimilarErrors).not.toHaveBeenCalled();
  });

  it('status, archive, analysis, and storage operations preserve current-store behavior', () => {
    const currentService = createCurrentService();
    const postgresFactory = vi.fn();
    const recorder = createErrorLogRecorder({
      currentService,
      postgresRepositoryFactory: postgresFactory,
      env: { DB_WRITE_ERROR_LOG_ENABLED: 'true', DB_READ_ERROR_LOG_ENABLED: 'true' },
    });

    expect(recorder.updateErrorStatus('err_1', 'investigating')).toEqual({ id: 'err_1', status: 'investigating' });
    expect(recorder.markErrorResolved('err_1')).toEqual({ id: 'err_1', status: 'resolved' });
    expect(recorder.archiveError('err_1')).toEqual({ id: 'err_1', status: 'archived' });
    expect(recorder.setErrorAnalysis('err_1', { ok: true })).toEqual({ id: 'err_1', aiAnalysis: { ok: true } });
    expect(recorder.getErrorLogStorageStatus()).toEqual({ backend: 'file', writeSafe: true });
    expect(postgresFactory).not.toHaveBeenCalled();
  });
});
