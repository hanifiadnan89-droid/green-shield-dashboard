import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(SERVER_DIR, 'scripts', 'validate-append-only-burn-in-staging.mjs');

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

function burnInEnv(overrides = {}) {
  return {
    NODE_ENV: 'staging',
    DATABASE_URL: 'postgres://app:app@db.staging.example.invalid:5432/stage41_ci',
    DATABASE_SSL: 'true',
    DB_WRITE_AI_USAGE_ENABLED: 'true',
    DB_WRITE_ERROR_LOG_ENABLED: 'true',
    DB_READ_AI_USAGE_ENABLED: 'false',
    DB_READ_ERROR_LOG_ENABLED: 'false',
    ...overrides,
  };
}

function healthyPostgresProbe({ aiRows = 3, errorRows = 2 } = {}) {
  return async () => ({
    reachable: true,
    migrationsApplied: true,
    migrationsPending: [],
    aiUsageTablePresent: true,
    errorLogTablePresent: true,
    aiUsageRecentRows: aiRows,
    errorLogRecentRows: errorRows,
    error: null,
  });
}

function readableCurrentStoreProbe() {
  return async () => ({
    aiUsageReadable: true,
    errorLogReadable: true,
    aiUsageError: null,
    errorLogError: null,
  });
}

const ORIGINAL_EXIT_CODE = process.exitCode;

describe('validate-append-only-burn-in-staging.mjs', () => {
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
    expect(pkg.scripts['db:validate:append-only:burn-in:staging'])
      .toBe('node scripts/validate-append-only-burn-in-staging.mjs');
  });

  it('is import-safe: exports main + helpers and does not touch process.env', async () => {
    const before = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
      NODE_ENV: process.env.NODE_ENV,
    });
    const mod = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
    expect(typeof mod.main).toBe('function');
    expect(typeof mod.runValidation).toBe('function');
    expect(typeof mod.parseArgs).toBe('function');
    expect(typeof mod.parseSinceMinutes).toBe('function');
    expect(typeof mod.stripForbidden).toBe('function');
    expect(mod.STAGE41_STAGE_ID).toBe('stage41_append_only_burn_in_staging');
    const after = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
      NODE_ENV: process.env.NODE_ENV,
    });
    expect(after).toBe(before);
  });

  it('script source does not import provider SDKs or Gmail/Twilio modules', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"]@anthropic-ai\/sdk['"]/);
    expect(src).not.toMatch(/from\s+['"]openai['"]/);
    expect(src).not.toMatch(/from\s+['"]twilio['"]/);
    expect(src).not.toMatch(/from\s+['"]nodemailer['"]/);
    expect(src).not.toMatch(/from\s+['"]googleapis['"]/);
  });

  it('parseSinceMinutes rejects non-integers, zero, negatives, and >7-day windows', async () => {
    const { parseSinceMinutes } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
    expect(() => parseSinceMinutes('')).toThrow(/positive integer/);
    expect(() => parseSinceMinutes('abc')).toThrow(/positive integer/);
    expect(() => parseSinceMinutes('0')).toThrow(/between 1 and 10080/);
    expect(() => parseSinceMinutes('-5')).toThrow(/positive integer/);
    expect(() => parseSinceMinutes('99999')).toThrow(/between 1 and 10080/);
    expect(parseSinceMinutes('60')).toBe(60);
    expect(parseSinceMinutes('10080')).toBe(10080);
  });

  describe('safety gates', () => {
    it('fails when NODE_ENV=production', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const logger = captureLogger();
      const result = await main([], logger, {
        envSource: burnInEnv({ NODE_ENV: 'production' }),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe('validation_failed');
      expect(result.summary.status).toBe('fail');
      const failCheck = result.summary.checks.find((c) => c.name === 'env_node_env_not_production');
      expect(failCheck?.status).toBe('fail');
      expect(failCheck?.reason).toBe('node_env_is_production');
      expect(process.exitCode).toBe(1);
    });

    it('fails when DATABASE_URL is missing', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const env = burnInEnv();
      delete env.DATABASE_URL;
      const result = await main([], captureLogger(), {
        envSource: env,
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      expect(result.summary.status).toBe('fail');
      const failCheck = result.summary.checks.find((c) => c.name === 'env_database_url_configured');
      expect(failCheck?.status).toBe('fail');
      expect(failCheck?.reason).toBe('database_url_missing');
    });

    it('fails when DB_READ_AI_USAGE_ENABLED is true', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv({ DB_READ_AI_USAGE_ENABLED: 'true' }),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const failCheck = result.summary.checks.find((c) => c.name === 'flags_read_ai_usage_off');
      expect(failCheck?.status).toBe('fail');
      expect(result.summary.status).toBe('fail');
    });

    it('fails when DB_READ_ERROR_LOG_ENABLED is true', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv({ DB_READ_ERROR_LOG_ENABLED: 'true' }),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const failCheck = result.summary.checks.find((c) => c.name === 'flags_read_error_log_off');
      expect(failCheck?.status).toBe('fail');
      expect(result.summary.status).toBe('fail');
    });

    it('fails when DB_WRITE_AI_USAGE_ENABLED is false during burn-in', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv({ DB_WRITE_AI_USAGE_ENABLED: 'false' }),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const failCheck = result.summary.checks.find((c) => c.name === 'flags_write_ai_usage_on_for_burn_in');
      expect(failCheck?.status).toBe('fail');
      expect(result.summary.status).toBe('fail');
    });

    it('fails when DB_WRITE_ERROR_LOG_ENABLED is false during burn-in', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv({ DB_WRITE_ERROR_LOG_ENABLED: 'false' }),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const failCheck = result.summary.checks.find((c) => c.name === 'flags_write_error_log_on_for_burn_in');
      expect(failCheck?.status).toBe('fail');
      expect(result.summary.status).toBe('fail');
    });
  });

  describe('database probe outcomes', () => {
    it('fails when migrations are missing', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: async () => ({
          reachable: true,
          migrationsApplied: false,
          migrationsPending: ['002_create_append_only_log_tables.sql'],
          aiUsageTablePresent: false,
          errorLogTablePresent: false,
          aiUsageRecentRows: 0,
          errorLogRecentRows: 0,
          error: null,
        }),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const failCheck = result.summary.checks.find((c) => c.name === 'db_migrations_applied');
      expect(failCheck?.status).toBe('fail');
      expect(failCheck?.reason).toBe('migrations_pending');
      expect(result.summary.status).toBe('fail');
    });

    it('fails when Postgres is unreachable and reports a sanitized reason (no stack)', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const err = new Error('connect ECONNREFUSED 127.0.0.1:5432\n    at Socket.emit (node:events:517:28)');
      err.code = 'ECONNREFUSED';
      const result = await main([], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: async () => { throw err; },
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const failCheck = result.summary.checks.find((c) => c.name === 'db_reachable');
      expect(failCheck?.status).toBe('fail');
      expect(failCheck?.reason).toBe('ECONNREFUSED');
      // Stack trace tokens must not appear anywhere in the serialized summary.
      const serialized = JSON.stringify(result.summary);
      expect(serialized).not.toMatch(/at Socket\.emit/);
      expect(serialized).not.toMatch(/node:events:/);
      expect(result.summary.status).toBe('fail');
    });

    it('passes when DB is reachable, migrations applied, write flags on, read flags off, and recent AI rows exist', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: healthyPostgresProbe({ aiRows: 5, errorRows: 2 }),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      expect(result.summary.status).toBe('pass');
      expect(result.summary.postgres.reachable).toBe(true);
      expect(result.summary.postgres.migrationsApplied).toBe(true);
      expect(result.summary.postgres.aiUsageRecentRows).toBe(5);
      expect(result.summary.postgres.errorLogRecentRows).toBe(2);
      expect(result.summary.flags).toEqual({
        dbWriteAIUsageEnabled: true,
        dbWriteErrorLogEnabled: true,
        dbReadAIUsageEnabled: false,
        dbReadErrorLogEnabled: false,
      });
      expect(result.ok).toBe(true);
      expect(process.exitCode).toBe(0);
    });

    it('warns (does not fail) when recent Error Center rows are zero', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: healthyPostgresProbe({ aiRows: 4, errorRows: 0 }),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const warnCheck = result.summary.checks.find((c) => c.name === 'db_error_log_recent_rows');
      expect(warnCheck?.status).toBe('warn');
      expect(warnCheck?.reason).toBe('no_recent_error_log_rows');
      expect(result.summary.status).toBe('warn');
      expect(process.exitCode).toBe(0);
    });

    it('warns (does not fail) when recent AI rows are zero and everything else is healthy', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: healthyPostgresProbe({ aiRows: 0, errorRows: 3 }),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const warnCheck = result.summary.checks.find((c) => c.name === 'db_ai_usage_recent_rows');
      expect(warnCheck?.status).toBe('warn');
      expect(result.summary.status).toBe('warn');
      expect(process.exitCode).toBe(0);
    });

    it('warns when the DATABASE_URL host contains a production-looking token', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv({ DATABASE_URL: 'postgres://app:app@db-production.example.com:5432/prod' }),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      const warnCheck = result.summary.checks.find((c) => c.name === 'env_no_production_indicators');
      expect(warnCheck?.status).toBe('warn');
      expect(warnCheck?.reason).toMatch(/database_url_host_contains_(prod|production|live)/);
    });
  });

  describe('current-store readability', () => {
    it('confirms current JSON/file stores remain readable', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      expect(result.summary.currentStore).toEqual({ aiUsageReadable: true, errorLogReadable: true });
      const ai = result.summary.checks.find((c) => c.name === 'current_store_ai_usage_readable');
      const err = result.summary.checks.find((c) => c.name === 'current_store_error_log_readable');
      expect(ai?.status).toBe('pass');
      expect(err?.status).toBe('pass');
    });

    it('fails when the current AI usage store is unreadable', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: async () => ({
          aiUsageReadable: false,
          errorLogReadable: true,
          aiUsageError: 'ENOENT',
          errorLogError: null,
        }),
      });
      const failCheck = result.summary.checks.find((c) => c.name === 'current_store_ai_usage_readable');
      expect(failCheck?.status).toBe('fail');
      expect(failCheck?.reason).toBe('ENOENT');
      expect(result.summary.status).toBe('fail');
    });

    it('fails when the current Error Center store is unreadable', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const result = await main([], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: async () => ({
          aiUsageReadable: true,
          errorLogReadable: false,
          aiUsageError: null,
          errorLogError: 'ENOENT',
        }),
      });
      const failCheck = result.summary.checks.find((c) => c.name === 'current_store_error_log_readable');
      expect(failCheck?.status).toBe('fail');
      expect(result.summary.status).toBe('fail');
    });
  });

  describe('report output', () => {
    it('--json emits a sanitized machine-readable summary and prints no human header', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const logger = captureLogger();
      const result = await main(['--json'], logger, {
        envSource: burnInEnv(),
        postgresProbe: healthyPostgresProbe(),
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      expect(result.ok).toBe(true);
      const stdoutJson = JSON.parse(logger.lines[0]);
      expect(stdoutJson.stage).toBe('stage41_append_only_burn_in_staging');
      expect(stdoutJson.status).toBe('pass');
      expect(stdoutJson).not.toHaveProperty('DATABASE_URL');
      expect(stdoutJson).not.toHaveProperty('database_url');
      expect(logger.lines.join('\n')).not.toMatch(/Stage 41 append-only burn-in validation:/);
    });

    it('--write-report writes a sanitized JSON report and never includes DATABASE_URL, passwords, bearer, or sk- tokens', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-stage41-report-'));
      const reportPath = path.join(tmpDir, 'burn-in.json');
      try {
        const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
        const err = new Error('connect failed with password=supersecret at postgres://app:supersecret@db/x Bearer abcdef123 sk-livekey321');
        err.code = null; // force message path
        const logger = captureLogger();
        const result = await main([`--write-report=${reportPath}`], logger, {
          envSource: burnInEnv({
            DATABASE_URL: 'postgres://app:supersecret@db.staging.example.invalid:5432/db',
          }),
          postgresProbe: async () => { throw err; },
          currentStoreProbe: readableCurrentStoreProbe(),
        });
        expect(result.ok).toBe(false); // db_reachable failed
        expect(fs.existsSync(reportPath)).toBe(true);
        const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        expect(parsed.reportType).toBe('append_only_burn_in_staging_validation');
        expect(parsed.schemaVersion).toBe('1.0.0');
        const serialized = JSON.stringify(parsed);
        expect(serialized).not.toMatch(/supersecret/);
        expect(serialized).not.toMatch(/postgres:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
        expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{4,}/);
        expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{4,}/);
        expect(serialized).not.toMatch(/"databaseUrl"/i);
        expect(serialized).not.toMatch(/"password"/i);
        expect(serialized).not.toMatch(/"stackTrace"/i);
      } finally {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('--since-minutes changes the validation window and appears in the report', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      const seenArgs = [];
      const spyProbe = async (args) => {
        seenArgs.push(args);
        return {
          reachable: true,
          migrationsApplied: true,
          migrationsPending: [],
          aiUsageTablePresent: true,
          errorLogTablePresent: true,
          aiUsageRecentRows: 1,
          errorLogRecentRows: 1,
          error: null,
        };
      };
      const result = await main(['--since-minutes=15'], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: spyProbe,
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      expect(seenArgs).toHaveLength(1);
      expect(seenArgs[0].sinceIso).toBeTypeOf('string');
      // Confirm the sinceIso is within a few seconds of now-15m.
      const expected = Date.now() - 15 * 60 * 1000;
      const actual = new Date(seenArgs[0].sinceIso).getTime();
      expect(Math.abs(actual - expected)).toBeLessThan(5000);
      expect(result.summary.window.sinceMinutes).toBe(15);
    });

    it('--since-minutes with invalid input exits 1 and does not run validation', async () => {
      const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
      let probeCalled = false;
      const result = await main(['--since-minutes=abc'], captureLogger(), {
        envSource: burnInEnv(),
        postgresProbe: async () => { probeCalled = true; return healthyPostgresProbe()(); },
        currentStoreProbe: readableCurrentStoreProbe(),
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe('invalid_argument');
      expect(probeCalled).toBe(false);
      expect(process.exitCode).toBe(1);
    });
  });

  it('process.env is not mutated across a full main() run', async () => {
    const { main } = await import('../../scripts/validate-append-only-burn-in-staging.mjs');
    const snapshot = { ...process.env };
    await main([], captureLogger(), {
      envSource: burnInEnv(),
      postgresProbe: healthyPostgresProbe(),
      currentStoreProbe: readableCurrentStoreProbe(),
    });
    for (const key of Object.keys(snapshot)) {
      expect(process.env[key]).toBe(snapshot[key]);
    }
    for (const key of Object.keys(process.env)) {
      expect(snapshot).toHaveProperty(key);
    }
  });
});
