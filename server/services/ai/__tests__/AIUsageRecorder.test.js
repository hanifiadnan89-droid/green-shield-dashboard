import { describe, expect, it, vi } from 'vitest';
import { createAIUsageRecorder } from '../AIUsageRecorder.js';

function createCurrentService() {
  return {
    recordAIUsage: vi.fn((entry) => ({ id: 'ai_usage_1', ...entry })),
    listAIUsage: vi.fn(() => [{ id: 'current' }]),
    summarizeAIUsage: vi.fn(() => ({ total: 1 })),
    getSafeAIUsageLogStorageStatus: vi.fn(() => ({ backend: 'file', writeSafe: true })),
    buildAIUsageEntry: vi.fn((input) => ({ id: 'ai_usage_built', ...input })),
  };
}

function createPostgresRepository() {
  return {
    recordUsage: vi.fn(async (entry) => ({ id: entry.id })),
    listUsage: vi.fn(async () => [{ id: 'postgres' }]),
    summarizeUsage: vi.fn(async () => ({ total: 2 })),
    getStorageStatus: vi.fn(() => ({ backend: 'postgres' })),
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AIUsageRecorder', () => {
  it('flags off records directly to AIUsageLogService only', async () => {
    const currentService = createCurrentService();
    const postgresFactory = vi.fn();
    const recorder = createAIUsageRecorder({
      currentService,
      postgresRepositoryFactory: postgresFactory,
      env: {},
    });

    const result = recorder.recordAIUsage({ feature: 'test' });
    await flushPromises();

    expect(result).toMatchObject({ id: 'ai_usage_1', feature: 'test' });
    expect(currentService.recordAIUsage).toHaveBeenCalledTimes(1);
    expect(postgresFactory).not.toHaveBeenCalled();
  });

  it('DB write flag records current store first, then Postgres', async () => {
    const currentService = createCurrentService();
    const postgres = createPostgresRepository();
    const recorder = createAIUsageRecorder({
      currentService,
      postgresRepositoryFactory: vi.fn(async () => postgres),
      env: { DB_WRITE_AI_USAGE_ENABLED: 'true' },
    });

    const result = recorder.recordAIUsage({ feature: 'test' });
    await flushPromises();

    expect(result).toMatchObject({ id: 'ai_usage_1' });
    expect(currentService.recordAIUsage).toHaveBeenCalledTimes(1);
    expect(postgres.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ id: 'ai_usage_1' }));
  });

  it('Postgres write failure does not break current-store result', async () => {
    const currentService = createCurrentService();
    const postgres = createPostgresRepository();
    const logger = { warn: vi.fn() };
    postgres.recordUsage.mockRejectedValueOnce(Object.assign(new Error('db down'), { code: 'ECONNREFUSED' }));
    const recorder = createAIUsageRecorder({
      currentService,
      postgresRepositoryFactory: vi.fn(async () => postgres),
      env: { DB_WRITE_AI_USAGE_ENABLED: 'true' },
      logger,
    });

    const result = recorder.recordAIUsage({ feature: 'test' });
    await flushPromises();

    expect(result).toMatchObject({ id: 'ai_usage_1' });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DB_DUAL_WRITE_AI_USAGE_FAILED'));
  });

  it('DB read flag off reads and summarizes from current store', async () => {
    const currentService = createCurrentService();
    const postgresFactory = vi.fn();
    const recorder = createAIUsageRecorder({
      currentService,
      postgresRepositoryFactory: postgresFactory,
      env: {},
    });

    await expect(recorder.listAIUsage({ limit: 10 })).resolves.toEqual([{ id: 'current' }]);
    await expect(recorder.summarizeAIUsage({})).resolves.toEqual({ total: 1 });
    expect(currentService.listAIUsage).toHaveBeenCalledWith({ limit: 10 });
    expect(currentService.summarizeAIUsage).toHaveBeenCalledWith({});
    expect(postgresFactory).not.toHaveBeenCalled();
  });

  it('DB read flag on reads and summarizes from Postgres repository', async () => {
    const currentService = createCurrentService();
    const postgres = createPostgresRepository();
    const recorder = createAIUsageRecorder({
      currentService,
      postgresRepositoryFactory: vi.fn(async () => postgres),
      env: { DB_READ_AI_USAGE_ENABLED: 'yes' },
    });

    await expect(recorder.listAIUsage({ limit: 10 })).resolves.toEqual([{ id: 'postgres' }]);
    await expect(recorder.summarizeAIUsage({})).resolves.toEqual({ total: 2 });
    expect(currentService.listAIUsage).not.toHaveBeenCalled();
    expect(currentService.summarizeAIUsage).not.toHaveBeenCalled();
    expect(postgres.listUsage).toHaveBeenCalledWith({ limit: 10 });
    expect(postgres.summarizeUsage).toHaveBeenCalledWith({});
  });

  it('storage status preserves current-store shape when flags are off', () => {
    const currentService = createCurrentService();
    const recorder = createAIUsageRecorder({ currentService, env: {} });

    expect(recorder.getSafeAIUsageLogStorageStatus()).toEqual({ backend: 'file', writeSafe: true });
  });

  it('storage status preserves current-store shape when DB flags are on', () => {
    const currentService = createCurrentService();
    const postgresFactory = vi.fn();
    const recorder = createAIUsageRecorder({
      currentService,
      postgresRepositoryFactory: postgresFactory,
      env: { DB_WRITE_AI_USAGE_ENABLED: 'true', DB_READ_AI_USAGE_ENABLED: 'true' },
    });

    expect(recorder.getSafeAIUsageLogStorageStatus()).toEqual({ backend: 'file', writeSafe: true });
    expect(postgresFactory).not.toHaveBeenCalled();
  });

  // Stage 41 burn-in regression — when the current-store recorder refuses the
  // write (writeSafe=false on Render staging), the recorder must still attempt
  // the Postgres shadow-write so DB_WRITE_AI_USAGE_ENABLED=true remains
  // meaningful for burn-in evidence. Prior behavior silently skipped Postgres.
  describe('current-store null-return path', () => {
    function nullReturningCurrentService() {
      return {
        recordAIUsage: vi.fn(() => null),
        listAIUsage: vi.fn(() => []),
        summarizeAIUsage: vi.fn(() => ({ total: 0 })),
        getSafeAIUsageLogStorageStatus: vi.fn(() => ({ backend: 'file', writeSafe: false, warning: 'production writes disabled' })),
        buildAIUsageEntry: vi.fn((input) => ({
          id: 'ai_usage_built_1',
          timestamp: input.timestamp || '2026-07-01T19:49:16.868Z',
          endpoint: input.endpoint,
          feature: input.feature,
          provider: input.provider,
          model: input.model,
          durationMs: input.durationMs || 0,
          inputSize: input.inputSize || 0,
          outputSize: input.outputSize || 0,
          success: Boolean(input.success),
          status: input.success ? 'success' : 'failure',
          errorCode: input.errorCode || null,
        })),
      };
    }

    it('does not touch Postgres when writeSafe=false but DB_WRITE_AI_USAGE_ENABLED is off', async () => {
      const currentService = nullReturningCurrentService();
      const postgresFactory = vi.fn();
      const recorder = createAIUsageRecorder({
        currentService,
        postgresRepositoryFactory: postgresFactory,
        env: {},
      });

      const result = recorder.recordAIUsage({
        endpoint: '/api/ai/sales-coach/module',
        feature: 'objectionCoach',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        success: true,
      });
      await flushPromises();

      expect(result).toBeNull();
      expect(currentService.recordAIUsage).toHaveBeenCalledTimes(1);
      expect(currentService.buildAIUsageEntry).not.toHaveBeenCalled();
      expect(postgresFactory).not.toHaveBeenCalled();
    });

    it('still attempts Postgres shadow-write when writeSafe=false but DB_WRITE_AI_USAGE_ENABLED=true', async () => {
      const currentService = nullReturningCurrentService();
      const postgres = createPostgresRepository();
      const logger = { warn: vi.fn() };
      const recorder = createAIUsageRecorder({
        currentService,
        postgresRepositoryFactory: vi.fn(async () => postgres),
        env: { DB_WRITE_AI_USAGE_ENABLED: 'true' },
        logger,
      });

      const result = recorder.recordAIUsage({
        endpoint: '/api/ai/sales-coach/module',
        feature: 'objectionCoach',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        durationMs: 16985,
        inputSize: 10844,
        outputSize: 2849,
        success: true,
      });
      await flushPromises();

      expect(result).toBeNull();
      expect(currentService.buildAIUsageEntry).toHaveBeenCalledTimes(1);
      expect(postgres.recordUsage).toHaveBeenCalledTimes(1);
      expect(postgres.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
        id: 'ai_usage_built_1',
        endpoint: '/api/ai/sales-coach/module',
        feature: 'objectionCoach',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        durationMs: 16985,
        inputSize: 10844,
        outputSize: 2849,
        success: true,
      }));
    });

    it('emits a throttled diagnostic exactly once per recorder even under repeated null-return calls', async () => {
      const currentService = nullReturningCurrentService();
      const postgres = createPostgresRepository();
      const logger = { warn: vi.fn() };
      const recorder = createAIUsageRecorder({
        currentService,
        postgresRepositoryFactory: vi.fn(async () => postgres),
        env: { DB_WRITE_AI_USAGE_ENABLED: 'true' },
        logger,
      });

      for (let i = 0; i < 5; i += 1) {
        recorder.recordAIUsage({
          endpoint: '/api/ai/sales-coach/module',
          feature: 'objectionCoach',
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          success: true,
        });
      }
      await flushPromises();

      const diagnostic = logger.warn.mock.calls.find(
        (call) => String(call[0]).includes('[aiUsageRecorder] current-store write skipped'),
      );
      expect(diagnostic).toBeTruthy();
      const diagnosticCount = logger.warn.mock.calls.filter(
        (call) => String(call[0]).includes('[aiUsageRecorder] current-store write skipped'),
      ).length;
      expect(diagnosticCount).toBe(1);
    });

    it('safe-warns and does not throw when the null-return Postgres shadow-write fails', async () => {
      const currentService = nullReturningCurrentService();
      const postgres = createPostgresRepository();
      postgres.recordUsage.mockRejectedValueOnce(
        Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
      );
      const logger = { warn: vi.fn() };
      const recorder = createAIUsageRecorder({
        currentService,
        postgresRepositoryFactory: vi.fn(async () => postgres),
        env: { DB_WRITE_AI_USAGE_ENABLED: 'true' },
        logger,
      });

      const result = recorder.recordAIUsage({
        endpoint: '/api/ai/sales-coach/module',
        feature: 'objectionCoach',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        success: true,
      });
      await flushPromises();

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DB_DUAL_WRITE_AI_USAGE_FAILED'),
      );
    });

    it('null-return diagnostic contains no DATABASE_URL, prompt text, response text, or api keys', async () => {
      const currentService = nullReturningCurrentService();
      const postgres = createPostgresRepository();
      const logger = { warn: vi.fn() };
      const recorder = createAIUsageRecorder({
        currentService,
        postgresRepositoryFactory: vi.fn(async () => postgres),
        env: {
          DB_WRITE_AI_USAGE_ENABLED: 'true',
          DATABASE_URL: 'postgres://app:supersecret@db.staging.example:5432/db',
          ANTHROPIC_API_KEY: 'sk-live-shouldnt-appear',
        },
        logger,
      });

      recorder.recordAIUsage({
        endpoint: '/api/ai/sales-coach/module',
        feature: 'objectionCoach',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        success: true,
        // Simulate a caller mistakenly stuffing a prompt into the entry.
        promptText: 'SECRET CUSTOMER PROMPT',
        responseText: 'SECRET AI RESPONSE',
      });
      await flushPromises();

      const serialized = JSON.stringify(logger.warn.mock.calls);
      expect(serialized).not.toContain('supersecret');
      expect(serialized).not.toContain('postgres://');
      expect(serialized).not.toContain('sk-live-shouldnt-appear');
      expect(serialized).not.toContain('SECRET CUSTOMER PROMPT');
      expect(serialized).not.toContain('SECRET AI RESPONSE');
      expect(serialized).not.toContain('DATABASE_URL');
      expect(serialized).not.toContain('ANTHROPIC_API_KEY');
    });

    it('DB_READ_AI_USAGE_ENABLED semantics are unchanged by the null-return fix', async () => {
      const currentService = nullReturningCurrentService();
      const postgres = createPostgresRepository();
      const recorder = createAIUsageRecorder({
        currentService,
        postgresRepositoryFactory: vi.fn(async () => postgres),
        env: { DB_WRITE_AI_USAGE_ENABLED: 'true' }, // read stays off
      });

      await expect(recorder.listAIUsage({ limit: 5 })).resolves.toEqual([]);
      expect(postgres.listUsage).not.toHaveBeenCalled();
      expect(currentService.listAIUsage).toHaveBeenCalledWith({ limit: 5 });
    });
  });
});
