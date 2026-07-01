import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(SERVER_DIR, 'scripts', 'exercise-append-only-dual-write-staging.mjs');

function captureLogger() {
  const lines = [];
  return {
    log: (...a) => lines.push(a.join(' ')),
    error: (...a) => lines.push(a.join(' ')),
    warn: (...a) => lines.push(a.join(' ')),
    info: (...a) => lines.push(a.join(' ')),
    lines,
  };
}

function stagingEnv(overrides = {}) {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://app:app@db.staging.example.invalid:5432/stage40_ci',
    DATABASE_SSL: 'false',
    DB_WRITE_AI_USAGE_ENABLED: 'false',
    DB_READ_AI_USAGE_ENABLED: 'false',
    DB_WRITE_ERROR_LOG_ENABLED: 'false',
    DB_READ_ERROR_LOG_ENABLED: 'false',
    ...overrides,
  };
}

function fakeAIRecorderFactory({ persistedToCurrent, scheduleDualWrite }) {
  return ({ env, postgresRepository }) => ({
    recordAIUsage(entry) {
      const record = { id: `ai_usage_synth_${Math.random().toString(16).slice(2, 10)}`, ...entry };
      persistedToCurrent.push(record);
      // Mirror the real recorder shape: fire-and-forget Postgres write when the flag is on.
      const dbWrite = String(env.DB_WRITE_AI_USAGE_ENABLED || '').toLowerCase() === 'true';
      if (dbWrite) {
        scheduleDualWrite(() => postgresRepository.recordUsage(record));
      }
      return record;
    },
  });
}

function fakeErrorRecorderFactory({ persistedToCurrent, scheduleDualWrite }) {
  return ({ env, postgresRepository }) => ({
    createError(input) {
      const record = { id: `err_synth_${Math.random().toString(16).slice(2, 10)}`, ...input };
      persistedToCurrent.push(record);
      const dbWrite = String(env.DB_WRITE_ERROR_LOG_ENABLED || '').toLowerCase() === 'true';
      if (dbWrite) {
        scheduleDualWrite(() => postgresRepository.createError(record));
      }
      return record;
    },
  });
}

function fakePostgresStores() {
  const aiRows = [];
  const errorRows = [];
  return {
    aiRows,
    errorRows,
    aiPostgresFactory: async () => ({
      async recordUsage(entry) { aiRows.push(entry); return entry; },
      async listUsage(filters = {}) {
        const matched = aiRows.filter((r) => !filters.feature || r.feature === filters.feature);
        return matched.slice(0, Number(filters.limit) || 50);
      },
    }),
    errorPostgresFactory: async () => ({
      async createError(entry) { errorRows.push(entry); return entry; },
      async getErrorById(id) { return errorRows.find((r) => r.id === id) || null; },
    }),
  };
}

const ORIGINAL_EXIT_CODE = process.exitCode;

describe('exercise-append-only-dual-write-staging.mjs', () => {
  beforeEach(() => {
    process.exitCode = 0;
    vi.restoreAllMocks();
  });
  afterEach(() => {
    process.exitCode = ORIGINAL_EXIT_CODE;
  });

  it('exists on disk and the package.json script wires to it', () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(SERVER_DIR, 'package.json'), 'utf-8'));
    expect(pkg.scripts['db:exercise:append-only:staging']).toBe('node scripts/exercise-append-only-dual-write-staging.mjs');
  });

  it('is import-safe and exports main + helpers without executing', async () => {
    const before = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
    });
    const mod = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    expect(typeof mod.main).toBe('function');
    expect(typeof mod.checkSafetyGates).toBe('function');
    expect(typeof mod.buildSyntheticAIUsageEntry).toBe('function');
    expect(typeof mod.buildSyntheticErrorEntry).toBe('function');
    expect(typeof mod.buildExerciseEnv).toBe('function');
    const after = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
    });
    expect(after).toBe(before);
  });

  it('refuses to run without --confirm-staging', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const logger = captureLogger();
    const result = await main([], logger, { envSource: stagingEnv() });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('refused');
    expect(process.exitCode).toBe(1);
    expect(logger.lines.join('\n')).toMatch(/--confirm-staging/);
  });

  it('refuses to run when NODE_ENV=production', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const logger = captureLogger();
    const result = await main(['--confirm-staging'], logger, { envSource: stagingEnv({ NODE_ENV: 'production' }) });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/NODE_ENV=production/);
    expect(process.exitCode).toBe(1);
  });

  it('refuses to run when DATABASE_URL is missing', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const logger = captureLogger();
    const env = stagingEnv();
    delete env.DATABASE_URL;
    const result = await main(['--confirm-staging'], logger, { envSource: env });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/DATABASE_URL is not configured/);
    expect(process.exitCode).toBe(1);
  });

  it('refuses to run when DB_READ_AI_USAGE_ENABLED is ON', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const logger = captureLogger();
    const result = await main(['--confirm-staging'], logger, {
      envSource: stagingEnv({ DB_READ_AI_USAGE_ENABLED: 'true' }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/DB_READ_AI_USAGE_ENABLED is ON/);
    expect(process.exitCode).toBe(1);
  });

  it('refuses to run when DB_READ_ERROR_LOG_ENABLED is ON', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const logger = captureLogger();
    const result = await main(['--confirm-staging'], logger, {
      envSource: stagingEnv({ DB_READ_ERROR_LOG_ENABLED: 'true' }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/DB_READ_ERROR_LOG_ENABLED is ON/);
    expect(process.exitCode).toBe(1);
  });

  it('buildExerciseEnv flips write flags ON and read flags OFF without mutating the input env', async () => {
    const { buildExerciseEnv } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const input = stagingEnv();
    const exerciseEnv = buildExerciseEnv(input);
    expect(exerciseEnv).not.toBe(input);
    expect(exerciseEnv.DB_WRITE_AI_USAGE_ENABLED).toBe('true');
    expect(exerciseEnv.DB_WRITE_ERROR_LOG_ENABLED).toBe('true');
    expect(exerciseEnv.DB_READ_AI_USAGE_ENABLED).toBe('false');
    expect(exerciseEnv.DB_READ_ERROR_LOG_ENABLED).toBe('false');
    // Input env is untouched.
    expect(input.DB_WRITE_AI_USAGE_ENABLED).toBe('false');
    expect(input.DB_READ_AI_USAGE_ENABLED).toBe('false');
  });

  it('synthetic AI entry uses only obvious synthetic values; no real provider, no real prompt', async () => {
    const { buildSyntheticAIUsageEntry, STAGE40_FEATURE } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const entry = buildSyntheticAIUsageEntry();
    expect(entry.feature).toBe(STAGE40_FEATURE);
    expect(entry.provider).toBe('synthetic');
    expect(entry.model).toBe('synthetic-validation-model');
    expect(entry.metadata).toMatchObject({
      exercise: true,
      stage: 40,
      environment: 'staging',
      synthetic: true,
    });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toMatch(/anthropic|openai|claude|gpt|whisper|gmail|twilio/i);
    expect(serialized).not.toMatch(/prompt|message|transcript|customer|phone|email/i);
  });

  it('synthetic Error Center entry uses safe sources and obvious synthetic provenance', async () => {
    const { buildSyntheticErrorEntry, STAGE40_FEATURE, STAGE40_ERROR_CODE } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const entry = buildSyntheticErrorEntry();
    expect(entry.source).toBe('backend');
    expect(entry.module).toBe(STAGE40_FEATURE);
    expect(entry.errorCode).toBe(STAGE40_ERROR_CODE);
    expect(entry.severity).toBe('low');
    expect(entry.message).toMatch(/Synthetic/);
    expect(entry.rawMetadata).toMatchObject({ exercise: true, stage: 40, environment: 'staging', synthetic: true });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toMatch(/at\s+\w+\s+\(/); // no stack trace
    expect(serialized).not.toMatch(/customer|phone|email|password|secret/i);
  });

  it('script source does not import provider SDKs or AI/Gmail/Twilio modules', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Check for actual imports/requires — descriptive mentions in --help text
    // (e.g. "no Gmail/Twilio") are deliberate operator guidance and must stay.
    expect(src).not.toMatch(/from\s+['"]@anthropic-ai\/sdk['"]/);
    expect(src).not.toMatch(/from\s+['"]openai['"]/);
    expect(src).not.toMatch(/from\s+['"]twilio['"]/);
    expect(src).not.toMatch(/from\s+['"]nodemailer['"]/);
    expect(src).not.toMatch(/from\s+['"]googleapis['"]/);
    expect(src).not.toMatch(/require\(['"]@anthropic-ai\/sdk['"]\)/);
    expect(src).not.toMatch(/require\(['"]openai['"]\)/);
    expect(src).not.toMatch(/require\(['"]twilio['"]\)/);
    expect(src).not.toMatch(/require\(['"]nodemailer['"]\)/);
    expect(src).not.toMatch(/require\(['"]googleapis['"]\)/);
  });

  it('runs the full exercise end-to-end via fakes — writes synthetic rows to both stores and reports pass', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const stores = fakePostgresStores();
    const aiPersisted = [];
    const errorPersisted = [];
    const pendingWrites = [];
    const aiRecorderFactory = fakeAIRecorderFactory({
      persistedToCurrent: aiPersisted,
      scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn)); },
    });
    const errorRecorderFactory = fakeErrorRecorderFactory({
      persistedToCurrent: errorPersisted,
      scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn)); },
    });

    const logger = captureLogger();
    const result = await main(['--confirm-staging'], logger, {
      envSource: stagingEnv(),
      aiPostgresFactory: stores.aiPostgresFactory,
      errorPostgresFactory: stores.errorPostgresFactory,
      recorderFactories: { aiRecorderFactory, errorRecorderFactory },
    });

    await Promise.allSettled(pendingWrites);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('exercise_passed');
    expect(result.summary.status).toBe('pass');
    expect(result.summary.aiUsage.currentStoreWritten).toBe(true);
    expect(result.summary.aiUsage.postgresWritten).toBe(true);
    expect(result.summary.errorLog.currentStoreWritten).toBe(true);
    expect(result.summary.errorLog.postgresWritten).toBe(true);
    expect(result.summary.writeFlagsUsed).toEqual({
      dbWriteAIUsageEnabled: true,
      dbWriteErrorLogEnabled: true,
      dbReadAIUsageEnabled: false,
      dbReadErrorLogEnabled: false,
    });
    expect(aiPersisted).toHaveLength(1);
    expect(stores.aiRows).toHaveLength(1);
    expect(errorPersisted).toHaveLength(1);
    expect(stores.errorRows).toHaveLength(1);
    expect(process.exitCode).toBe(0);
  });

  it('--write-report writes a sanitized JSON report and exits 0 on pass', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-stage40-report-'));
    const reportPath = path.join(tmpDir, 'exercise.json');
    try {
      const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
      const stores = fakePostgresStores();
      const aiPersisted = [];
      const errorPersisted = [];
      const pendingWrites = [];
      const logger = captureLogger();
      const result = await main([
        '--confirm-staging',
        `--write-report=${reportPath}`,
      ], logger, {
        envSource: stagingEnv(),
        aiPostgresFactory: stores.aiPostgresFactory,
        errorPostgresFactory: stores.errorPostgresFactory,
        recorderFactories: {
          aiRecorderFactory: fakeAIRecorderFactory({
            persistedToCurrent: aiPersisted,
            scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn)); },
          }),
          errorRecorderFactory: fakeErrorRecorderFactory({
            persistedToCurrent: errorPersisted,
            scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn)); },
          }),
        },
      });
      await Promise.allSettled(pendingWrites);

      expect(result.ok).toBe(true);
      expect(fs.existsSync(reportPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      expect(parsed.reportType).toBe('append_only_dual_write_staging_exercise');
      expect(parsed.schemaVersion).toBe('1.0.0');
      expect(parsed.environment).toBe('staging');
      expect(parsed.status).toBe('pass');
      const serialized = JSON.stringify(parsed);
      expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
      expect(serialized).not.toMatch(/Bearer\s+/);
      expect(serialized).not.toMatch(/postgres:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
      expect(serialized).not.toMatch(/"databaseUrl"/i);
    } finally {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('default behavior writes no report file', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const stores = fakePostgresStores();
    const pendingWrites = [];
    const logger = captureLogger();
    const result = await main(['--confirm-staging'], logger, {
      envSource: stagingEnv(),
      aiPostgresFactory: stores.aiPostgresFactory,
      errorPostgresFactory: stores.errorPostgresFactory,
      recorderFactories: {
        aiRecorderFactory: fakeAIRecorderFactory({
          persistedToCurrent: [],
          scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn)); },
        }),
        errorRecorderFactory: fakeErrorRecorderFactory({
          persistedToCurrent: [],
          scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn)); },
        }),
      },
    });
    await Promise.allSettled(pendingWrites);
    expect(result.reportPath).toBeNull();
  });

  it('fails when the Postgres write throws (does not silently pass)', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const pendingWrites = [];
    const logger = captureLogger();
    const failingAIPg = {
      async recordUsage() { throw new Error('connect ECONNREFUSED'); },
      async listUsage() { return []; },
    };
    const failingErrPg = {
      async createError() { throw new Error('connect ECONNREFUSED'); },
      async getErrorById() { return null; },
    };
    const result = await main(['--confirm-staging'], logger, {
      envSource: stagingEnv(),
      aiPostgresFactory: async () => failingAIPg,
      errorPostgresFactory: async () => failingErrPg,
      recorderFactories: {
        aiRecorderFactory: fakeAIRecorderFactory({
          persistedToCurrent: [],
          scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn).catch(() => {})); },
        }),
        errorRecorderFactory: fakeErrorRecorderFactory({
          persistedToCurrent: [],
          scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn).catch(() => {})); },
        }),
      },
    });
    await Promise.allSettled(pendingWrites);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('exercise_failed');
    expect(result.summary.status).toBe('fail');
    expect(process.exitCode).toBe(1);
  });

  // Stage 40 failure-mode coverage — regression for the real staging run where
  // both postgresWritten were false with error null because the exercise
  // awaited an empty tracker before the recorder's fire-and-forget microtask
  // ran. The tests below invoke runExercise directly so we can drive the
  // recorder shape end-to-end and inspect the reason/error surface.
  describe('runExercise failure-mode reporting', () => {
    function deferredMicrotaskRecorder({ writeFn }) {
      // Mirrors the real recorder: returns currentResult synchronously and
      // kicks the Postgres write onto a Promise.resolve().then(...) chain that
      // resolves only after several microtasks. This is the exact shape that
      // caused the tracker to be empty on the first await.
      return ({ postgresRepository }) => ({
        recordAIUsage(entry) {
          const record = { id: `ai_usage_synth_${Math.random().toString(16).slice(2, 10)}`, ...entry };
          Promise.resolve()
            .then(() => Promise.resolve())
            .then(() => writeFn(postgresRepository, record))
            .catch(() => {});
          return record;
        },
        createError(input) {
          const record = { id: `err_synth_${Math.random().toString(16).slice(2, 10)}`, ...input };
          Promise.resolve()
            .then(() => Promise.resolve())
            .then(() => writeFn(postgresRepository, record))
            .catch(() => {});
          return record;
        },
      });
    }

    async function runOnce({ aiRepo, errorRepo, aiRecorderFactory, errorRecorderFactory }) {
      const mod = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
      return mod.runExercise({
        env: {
          DB_WRITE_AI_USAGE_ENABLED: 'true',
          DB_WRITE_ERROR_LOG_ENABLED: 'true',
          DB_READ_AI_USAGE_ENABLED: 'false',
          DB_READ_ERROR_LOG_ENABLED: 'false',
        },
        aiPostgresRepository: aiRepo,
        errorPostgresRepository: errorRepo,
        aiRecorderFactory,
        errorRecorderFactory,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });
    }

    it('reports postgres_write_not_observed when the recorder never calls the wrapped Postgres write', async () => {
      const aiRepo = {
        async recordUsage() { throw new Error('should not be called'); },
        async listUsage() { return []; },
      };
      const errorRepo = {
        async createError() { throw new Error('should not be called'); },
        async getErrorById() { return null; },
      };
      // Recorder returns a synchronous current record but never touches the
      // Postgres repo at all.
      const noopFactory = () => ({
        recordAIUsage(entry) { return { id: 'ai_usage_never_writes', ...entry }; },
        createError(input) { return { id: 'err_never_writes', ...input }; },
      });
      const summary = await runOnce({
        aiRepo,
        errorRepo,
        aiRecorderFactory: noopFactory,
        errorRecorderFactory: noopFactory,
      });
      expect(summary.status).toBe('fail');
      expect(summary.aiUsage.currentStoreWritten).toBe(true);
      expect(summary.aiUsage.postgresWritten).toBe(false);
      expect(summary.aiUsage.reason).toBe('postgres_write_not_observed');
      expect(summary.aiUsage.error).toBeNull();
      expect(summary.errorLog.currentStoreWritten).toBe(true);
      expect(summary.errorLog.postgresWritten).toBe(false);
      expect(summary.errorLog.reason).toBe('postgres_write_not_observed');
      expect(summary.errorLog.error).toBeNull();
    }, 15000);

    it('reports postgres_verification_not_found when the write lands but the read cannot find the row', async () => {
      // Write silently accepts and drops the row.
      const aiRepo = {
        async recordUsage() { /* accept and drop */ },
        async listUsage() { return []; },
      };
      const errorRepo = {
        async createError() { /* accept and drop */ },
        async getErrorById() { return null; },
      };
      const factory = deferredMicrotaskRecorder({
        writeFn: (repo, record) => {
          if (typeof repo.recordUsage === 'function') return repo.recordUsage(record);
          return repo.createError(record);
        },
      });
      const summary = await runOnce({
        aiRepo,
        errorRepo,
        aiRecorderFactory: factory,
        errorRecorderFactory: factory,
      });
      expect(summary.status).toBe('fail');
      expect(summary.aiUsage.postgresWritten).toBe(false);
      expect(summary.aiUsage.reason).toBe('postgres_verification_not_found');
      expect(summary.aiUsage.error).toBeNull();
      expect(summary.errorLog.postgresWritten).toBe(false);
      expect(summary.errorLog.reason).toBe('postgres_verification_not_found');
      expect(summary.errorLog.error).toBeNull();
    });

    it('reports postgres_write_failed when the Postgres write throws (real recorder shape)', async () => {
      const aiRepo = {
        async recordUsage() { const e = new Error('connect ECONNREFUSED 127.0.0.1:5432'); e.code = 'ECONNREFUSED'; throw e; },
        async listUsage() { return []; },
      };
      const errorRepo = {
        async createError() { const e = new Error('relation "error_log" does not exist'); e.code = '42P01'; throw e; },
        async getErrorById() { return null; },
      };
      const factory = deferredMicrotaskRecorder({
        writeFn: (repo, record) => {
          if (typeof repo.recordUsage === 'function') return repo.recordUsage(record);
          return repo.createError(record);
        },
      });
      const summary = await runOnce({
        aiRepo,
        errorRepo,
        aiRecorderFactory: factory,
        errorRecorderFactory: factory,
      });
      expect(summary.status).toBe('fail');
      expect(summary.aiUsage.reason).toBe('postgres_write_failed');
      expect(summary.aiUsage.error).toBe('ECONNREFUSED');
      expect(summary.errorLog.reason).toBe('postgres_write_failed');
      expect(summary.errorLog.error).toBe('42P01');
    });

    it('reports verification_query_failed when the write lands but the read query throws', async () => {
      const rows = [];
      const aiRepo = {
        async recordUsage(entry) { rows.push(entry); },
        async listUsage() { throw new Error('read replica unreachable'); },
      };
      const errorRepo = {
        async createError(entry) { rows.push(entry); },
        async getErrorById() { const e = new Error('query cancelled'); e.code = '57014'; throw e; },
      };
      const factory = deferredMicrotaskRecorder({
        writeFn: (repo, record) => {
          if (typeof repo.recordUsage === 'function') return repo.recordUsage(record);
          return repo.createError(record);
        },
      });
      const summary = await runOnce({
        aiRepo,
        errorRepo,
        aiRecorderFactory: factory,
        errorRecorderFactory: factory,
      });
      expect(summary.status).toBe('fail');
      expect(summary.aiUsage.reason).toBe('verification_query_failed');
      expect(summary.aiUsage.error).toBe('read replica unreachable');
      expect(summary.errorLog.reason).toBe('verification_query_failed');
      expect(summary.errorLog.error).toBe('57014');
    });

    it('reports postgresWritten=true when the write lands and verification finds the row (deferred microtask, real recorder shape)', async () => {
      const aiRows = [];
      const errorRows = [];
      const aiRepo = {
        async recordUsage(entry) { aiRows.push(entry); },
        async listUsage(filters = {}) {
          return aiRows.filter((r) => !filters.feature || r.feature === filters.feature);
        },
      };
      const errorRepo = {
        async createError(entry) { errorRows.push(entry); },
        async getErrorById(id) { return errorRows.find((r) => r.id === id) || null; },
      };
      const factory = deferredMicrotaskRecorder({
        writeFn: (repo, record) => {
          if (typeof repo.recordUsage === 'function') return repo.recordUsage(record);
          return repo.createError(record);
        },
      });
      const summary = await runOnce({
        aiRepo,
        errorRepo,
        aiRecorderFactory: factory,
        errorRecorderFactory: factory,
      });
      expect(summary.status).toBe('pass');
      expect(summary.aiUsage.postgresWritten).toBe(true);
      expect(summary.aiUsage.reason).toBeNull();
      expect(summary.aiUsage.error).toBeNull();
      expect(summary.errorLog.postgresWritten).toBe(true);
      expect(summary.errorLog.reason).toBeNull();
      expect(summary.errorLog.error).toBeNull();
      expect(aiRows).toHaveLength(1);
      expect(errorRows).toHaveLength(1);
    });

    it('does not print DATABASE_URL, passwords, or bearer tokens even when the pg error message contains them', async () => {
      const aiRepo = {
        async recordUsage() {
          throw new Error('password authentication failed for user "app" at postgres://app:supersecret@db.staging.example:5432/db, Bearer abcdefghijklmnop');
        },
        async listUsage() { return []; },
      };
      const errorRepo = {
        async createError() {
          throw new Error('sk-livekey123abc failed to authenticate against postgresql://x:y@host/db');
        },
        async getErrorById() { return null; },
      };
      const factory = deferredMicrotaskRecorder({
        writeFn: (repo, record) => {
          if (typeof repo.recordUsage === 'function') return repo.recordUsage(record);
          return repo.createError(record);
        },
      });
      const summary = await runOnce({
        aiRepo,
        errorRepo,
        aiRecorderFactory: factory,
        errorRecorderFactory: factory,
      });
      const serialized = JSON.stringify(summary);
      expect(serialized).not.toMatch(/supersecret/);
      expect(serialized).not.toMatch(/postgres:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
      expect(serialized).not.toMatch(/postgresql:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
      expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{4,}/);
      expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{4,}/);
    });
  });

  it('process.env is not mutated across a full main() run even with the deferred-microtask recorder shape', async () => {
    const { main } = await import('../../scripts/exercise-append-only-dual-write-staging.mjs');
    const before = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
    });
    const stores = fakePostgresStores();
    const pendingWrites = [];
    await main(['--confirm-staging'], captureLogger(), {
      envSource: stagingEnv(),
      aiPostgresFactory: stores.aiPostgresFactory,
      errorPostgresFactory: stores.errorPostgresFactory,
      recorderFactories: {
        aiRecorderFactory: fakeAIRecorderFactory({
          persistedToCurrent: [],
          scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn)); },
        }),
        errorRecorderFactory: fakeErrorRecorderFactory({
          persistedToCurrent: [],
          scheduleDualWrite: (fn) => { pendingWrites.push(Promise.resolve().then(fn)); },
        }),
      },
    });
    await Promise.allSettled(pendingWrites);
    const after = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
    });
    expect(after).toBe(before);
  });
});
