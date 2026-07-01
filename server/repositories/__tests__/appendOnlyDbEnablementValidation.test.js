import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  validateAppendOnlyDbEnablement,
  buildAppendOnlyDbEnablementReport,
  writeAppendOnlyDbEnablementReport,
  REPORT_SCHEMA_VERSION,
  REPORT_TYPE,
  REPORT_GENERATED_BY,
  REQUIRED_MIGRATION_FILES,
  REQUIRED_BACKFILL_SCRIPTS,
  REQUIRED_DOCS,
  RECOMMENDED_COMMANDS,
} from '../backfill/appendOnlyDbEnablementValidation.js';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const REPO_DIR = path.resolve(SERVER_DIR, '..');
const MIGRATIONS_DIR = path.join(SERVER_DIR, 'migrations');

function findCheck(result, name) {
  return result.checks.find((check) => check.name === name);
}

function alwaysExists() { return true; }

const ORIGINAL_ENV = { ...process.env };

function baseEnv(extra = {}) {
  return {
    ...ORIGINAL_ENV,
    DATABASE_URL: 'postgres://app:hunter2@db.internal:5432/appdb?sslmode=disable',
    DATABASE_SSL: 'false',
    DB_WRITE_AI_USAGE_ENABLED: 'false',
    DB_READ_AI_USAGE_ENABLED: 'false',
    DB_WRITE_ERROR_LOG_ENABLED: 'false',
    DB_READ_ERROR_LOG_ENABLED: 'false',
    ...extra,
  };
}

function fakeHealthy() {
  return async () => ({
    status: 'healthy',
    configured: true,
    checkedAt: new Date().toISOString(),
    durationMs: 1,
    config: { configured: true, redactedDatabaseUrl: 'postgres://***:***@db.internal:5432/appdb?sslmode=disable' },
  });
}

function fakeMigrationsAllApplied() {
  return async () => REQUIRED_MIGRATION_FILES.map((name) => ({ name, status: 'applied', appliedAt: '2026-06-30T00:00:00.000Z' }));
}

function fakeMigrationsAllPending() {
  return async () => REQUIRED_MIGRATION_FILES.map((name) => ({ name, status: 'pending', appliedAt: null }));
}

describe('validateAppendOnlyDbEnablement', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails when DATABASE_URL is missing', async () => {
    const env = baseEnv();
    delete env.DATABASE_URL;
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    expect(result.status).toBe('fail');
    const configured = findCheck(result, 'database_configured');
    expect(configured.status).toBe('fail');
    expect(configured.message).toMatch(/DATABASE_URL is not configured/);
    const health = findCheck(result, 'database_health');
    expect(health.status).toBe('warn');
    expect(health.details.skipped).toBe(true);
  });

  it('redacts DATABASE_URL credentials in the configured check details', async () => {
    const env = baseEnv({ DATABASE_URL: 'postgres://app:hunter2@db.internal:5432/appdb' });
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('app:hunter2');
    const configured = findCheck(result, 'database_configured');
    expect(configured.details.redactedDatabaseUrl).toContain('***');
    expect(configured.details.redactedDatabaseUrl).not.toContain('hunter2');
  });

  it('reports DB health result from an injected healthy check', async () => {
    const env = baseEnv();
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    const health = findCheck(result, 'database_health');
    expect(health.status).toBe('pass');
    expect(health.message).toMatch(/passed/i);
  });

  it('reports failure when the injected health check returns unhealthy', async () => {
    const env = baseEnv();
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: async () => ({
        status: 'unhealthy',
        errorCode: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED',
      }),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    expect(result.status).toBe('fail');
    const health = findCheck(result, 'database_health');
    expect(health.status).toBe('fail');
    expect(health.details.errorCode).toBe('ECONNREFUSED');
  });

  it('reports failure when the health check throws', async () => {
    const env = baseEnv();
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: async () => { const err = new Error('boom'); err.code = 'ETIMEDOUT'; throw err; },
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    expect(result.status).toBe('fail');
    const health = findCheck(result, 'database_health');
    expect(health.status).toBe('fail');
    expect(health.details.errorCode).toBe('ETIMEDOUT');
  });

  it('warns when migrations are pending and tells the operator to run db:migrate', async () => {
    const env = baseEnv();
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllPending(),
      pathExists: alwaysExists,
    });
    const status = findCheck(result, 'migration_status');
    expect(status.status).toBe('warn');
    expect(status.message).toMatch(/Pending migrations/);
    expect(status.message).toMatch(/db:migrate/);
    expect(result.status).toBe('warn');
  });

  it('fails when migration status reports the required migrations missing entirely', async () => {
    const env = baseEnv();
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: async () => [],
      pathExists: alwaysExists,
    });
    const status = findCheck(result, 'migration_status');
    expect(status.status).toBe('fail');
    expect(status.details.missing).toEqual([...REQUIRED_MIGRATION_FILES]);
  });

  it('warns if a DB write flag is already on (premature enablement)', async () => {
    const env = baseEnv({ DB_WRITE_AI_USAGE_ENABLED: 'true' });
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    const flags = findCheck(result, 'feature_flags');
    expect(flags.status).toBe('warn');
    expect(flags.details.enabled).toEqual(['DB_WRITE_AI_USAGE_ENABLED']);
    expect(result.status).toBe('warn');
  });

  it('fails if a read flag is on while its corresponding write flag is off', async () => {
    const env = baseEnv({ DB_READ_AI_USAGE_ENABLED: 'true', DB_WRITE_AI_USAGE_ENABLED: 'false' });
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    const flags = findCheck(result, 'feature_flags');
    expect(flags.status).toBe('fail');
    expect(flags.details.prematureReadFlags).toEqual(['DB_READ_AI_USAGE_ENABLED']);
    expect(result.status).toBe('fail');
  });

  it('passes feature flags when read+write are both ON for the same domain', async () => {
    const env = baseEnv({
      DB_WRITE_AI_USAGE_ENABLED: 'true',
      DB_READ_AI_USAGE_ENABLED: 'true',
    });
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    const flags = findCheck(result, 'feature_flags');
    // Both flags ON is a WARN (writes already on, not a fail)
    expect(flags.status).toBe('warn');
    expect(flags.details.prematureReadFlags ?? []).toEqual([]);
  });

  it('fails when backfill scripts are missing', async () => {
    const env = baseEnv();
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: (p) => !REQUIRED_BACKFILL_SCRIPTS.includes(p),
    });
    const tooling = findCheck(result, 'backfill_tooling_present');
    expect(tooling.status).toBe('fail');
    expect(tooling.details.missingBasenames).toEqual([
      'backfill-append-only-logs.mjs',
      'reconcile-append-only-logs.mjs',
    ]);
  });

  it('fails when any required doc is missing', async () => {
    const env = baseEnv();
    const missingDoc = REQUIRED_DOCS[REQUIRED_DOCS.length - 1];
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: (p) => p !== missingDoc,
    });
    const docs = findCheck(result, 'documentation_present');
    expect(docs.status).toBe('fail');
    expect(docs.details.missingBasenames).toContain(path.basename(missingDoc));
  });

  it('confirms required scripts and docs exist on disk', () => {
    for (const filePath of REQUIRED_BACKFILL_SCRIPTS) {
      expect(fs.existsSync(filePath)).toBe(true);
    }
    for (const filePath of REQUIRED_DOCS) {
      expect(fs.existsSync(filePath)).toBe(true);
    }
    for (const name of REQUIRED_MIGRATION_FILES) {
      expect(fs.existsSync(path.join(MIGRATIONS_DIR, name))).toBe(true);
    }
  });

  it('returns the recommended command sequence including migrate, backfill apply, reconcile, and strict reconcile', async () => {
    const env = baseEnv();
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    expect(result.recommendedCommands).toEqual([...RECOMMENDED_COMMANDS]);
    const joined = result.recommendedCommands.join('\n');
    expect(joined).toContain('db:migrate:status');
    expect(joined).toContain('db:migrate');
    expect(joined).toContain('db:backfill:append-only');
    expect(joined).toContain('--apply');
    expect(joined).toContain('db:reconcile:append-only');
    expect(joined).toContain('--strict');
    expect(joined).toContain('DB_WRITE_AI_USAGE_ENABLED=true');
    expect(joined).toContain('DB_WRITE_ERROR_LOG_ENABLED=true');
    expect(joined).toContain('DB_READ_');
    expect(joined).toMatch(/keep both DB_READ_\* flags OFF/i);
  });

  it('does not contain secrets or DATABASE_URL credentials anywhere in the returned object', async () => {
    const env = baseEnv({ DATABASE_URL: 'postgres://service:supersecret@example.com:5432/appdb' });
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('supersecret');
    expect(serialized).not.toContain('service:supersecret');
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toContain('Bearer');
  });

  it('rolls up to pass when every check passes', async () => {
    const env = baseEnv();
    const result = await validateAppendOnlyDbEnablement({
      env,
      healthCheck: fakeHealthy(),
      migrationStatusCheck: fakeMigrationsAllApplied(),
      pathExists: alwaysExists,
    });
    expect(result.status).toBe('pass');
    for (const check of result.checks) {
      expect(['pass', 'warn', 'fail']).toContain(check.status);
    }
  });
});

// ---------------------------------------------------------------------------
// Stage 35 — pre-flight report builder + writer
// ---------------------------------------------------------------------------

function fakeValidationResult(overrides = {}) {
  return {
    status: 'pass',
    checks: [
      {
        name: 'database_configured',
        status: 'pass',
        message: 'DATABASE_URL is configured.',
        details: {
          configured: true,
          redactedDatabaseUrl: 'postgres://***:***@db.internal:5432/appdb',
          safeConfig: { configured: true, sslEnabled: true },
        },
      },
      {
        name: 'database_health',
        status: 'pass',
        message: 'Database connectivity check passed.',
        details: { durationMs: 4 },
      },
      {
        name: 'migration_files_present',
        status: 'pass',
        message: 'All required append-only migration files are present.',
        details: { present: [...REQUIRED_MIGRATION_FILES] },
      },
      {
        name: 'migration_status',
        status: 'pass',
        message: 'All required append-only migrations are applied.',
        details: { appliedCount: REQUIRED_MIGRATION_FILES.length },
      },
      {
        name: 'feature_flags',
        status: 'pass',
        message: 'All append-only DB flags are OFF (safe initial state).',
        details: {
          flags: {
            dbWriteAIUsageEnabled: false,
            dbReadAIUsageEnabled: false,
            dbWriteErrorLogEnabled: false,
            dbReadErrorLogEnabled: false,
          },
        },
      },
      {
        name: 'backfill_tooling_present',
        status: 'pass',
        message: 'Backfill and reconciliation scripts are present.',
        details: { scriptBasenames: ['backfill-append-only-logs.mjs', 'reconcile-append-only-logs.mjs'] },
      },
      {
        name: 'documentation_present',
        status: 'pass',
        message: 'All required runbook and dual-write docs are present.',
        details: { docBasenames: ['append-only-db-enablement-runbook.md'] },
      },
    ],
    recommendedCommands: [...RECOMMENDED_COMMANDS],
    ...overrides,
  };
}

describe('buildAppendOnlyDbEnablementReport', () => {
  it('includes status, checks, generatedAt, recommendedCommands, and safeSummary', () => {
    const result = fakeValidationResult();
    const report = buildAppendOnlyDbEnablementReport(result, { generatedAt: '2026-06-30T00:00:00.000Z' });

    expect(report.reportType).toBe(REPORT_TYPE);
    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(report.generatedBy).toBe(REPORT_GENERATED_BY);
    expect(report.generatedAt).toBe('2026-06-30T00:00:00.000Z');
    expect(report.status).toBe('pass');
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks).toHaveLength(7);
    expect(report.recommendedCommands).toEqual([...RECOMMENDED_COMMANDS]);
    expect(report.safeSummary).toEqual({
      databaseConfigured: true,
      writeFlagsEnabled: false,
      readFlagsEnabled: false,
      migrationChecksIncluded: true,
      backfillToolingPresent: true,
      documentationPresent: true,
    });
  });

  it('counts warnings and failures', () => {
    const result = fakeValidationResult({
      status: 'fail',
      checks: [
        { name: 'database_configured', status: 'fail', message: 'missing', details: {} },
        { name: 'feature_flags', status: 'warn', message: 'write flag on', details: { flags: { dbWriteAIUsageEnabled: true } } },
      ],
    });
    const report = buildAppendOnlyDbEnablementReport(result);
    expect(report.failureCount).toBe(1);
    expect(report.warningCount).toBe(1);
    expect(report.safeSummary.writeFlagsEnabled).toBe(true);
    expect(report.safeSummary.readFlagsEnabled).toBe(false);
  });

  it('throws when validationResult is missing', () => {
    expect(() => buildAppendOnlyDbEnablementReport(null)).toThrow(/validationResult is required/);
  });

  it('never includes DATABASE_URL credentials, secrets, or forbidden top-level keys', () => {
    const result = fakeValidationResult();
    const report = buildAppendOnlyDbEnablementReport(result, { generatedAt: '2026-06-30T00:00:00.000Z' });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/postgres:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]+/);
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('hunter2');
  });

  it('strips defense-in-depth forbidden keys even if a future leak slips into checks', () => {
    const result = fakeValidationResult({
      checks: [
        {
          name: 'database_configured',
          status: 'pass',
          message: 'leaky',
          details: {
            databaseUrl: 'postgres://service:supersecret@db.internal:5432/appdb',
            apiKey: 'sk-do-not-leak',
            Authorization: 'Bearer leak',
            cookie: 'session=do-not-leak',
            password: 'do-not-leak',
            token: 'do-not-leak',
            secret: 'do-not-leak',
            api_key: 'do-not-leak',
            safeValue: 'visible',
          },
        },
      ],
    });
    const report = buildAppendOnlyDbEnablementReport(result, { generatedAt: '2026-06-30T00:00:00.000Z' });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('supersecret');
    expect(serialized).not.toContain('sk-do-not-leak');
    expect(serialized).not.toContain('Bearer leak');
    expect(serialized).not.toContain('do-not-leak');
    expect(report.checks[0].details).not.toHaveProperty('databaseUrl');
    expect(report.checks[0].details).not.toHaveProperty('apiKey');
    expect(report.checks[0].details).not.toHaveProperty('api_key');
    expect(report.checks[0].details).not.toHaveProperty('Authorization');
    expect(report.checks[0].details).not.toHaveProperty('cookie');
    expect(report.checks[0].details).not.toHaveProperty('password');
    expect(report.checks[0].details).not.toHaveProperty('token');
    expect(report.checks[0].details).not.toHaveProperty('secret');
    expect(report.checks[0].details.safeValue).toBe('visible');
  });
});

describe('writeAppendOnlyDbEnablementReport', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-aoreport-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the sanitized report JSON to disk and returns the absolute path', () => {
    const reportPath = path.join(tmpDir, 'report.json');
    const { reportPath: writtenPath, report } = writeAppendOnlyDbEnablementReport(
      fakeValidationResult(),
      reportPath,
      { generatedAt: '2026-06-30T00:00:00.000Z' },
    );
    expect(writtenPath).toBe(path.resolve(reportPath));
    expect(fs.existsSync(reportPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    expect(parsed.reportType).toBe(REPORT_TYPE);
    expect(parsed.status).toBe('pass');
    expect(parsed.safeSummary.databaseConfigured).toBe(true);
    expect(report.reportType).toBe(REPORT_TYPE);
  });

  it('creates parent directories if they do not exist', () => {
    const reportPath = path.join(tmpDir, 'nested', 'deeper', 'report.json');
    writeAppendOnlyDbEnablementReport(fakeValidationResult(), reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
  });

  it('rejects empty paths', () => {
    expect(() => writeAppendOnlyDbEnablementReport(fakeValidationResult(), '')).toThrow(/non-empty string/);
    expect(() => writeAppendOnlyDbEnablementReport(fakeValidationResult(), '   ')).toThrow(/non-empty string/);
    expect(() => writeAppendOnlyDbEnablementReport(fakeValidationResult(), null)).toThrow(/non-empty string/);
  });

  it('does not include DATABASE_URL or secret-shaped strings in the written file', () => {
    const reportPath = path.join(tmpDir, 'report.json');
    const leakyResult = fakeValidationResult({
      checks: [
        {
          name: 'database_configured',
          status: 'pass',
          message: 'fine',
          details: {
            redactedDatabaseUrl: 'postgres://***:***@db.internal:5432/appdb',
            apiKey: 'sk-must-not-leak',
            password: 'leakable-password',
          },
        },
        ...fakeValidationResult().checks.slice(1),
      ],
    });
    writeAppendOnlyDbEnablementReport(leakyResult, reportPath);
    const raw = fs.readFileSync(reportPath, 'utf-8');
    expect(raw).not.toContain('sk-must-not-leak');
    expect(raw).not.toContain('leakable-password');
    expect(raw).not.toMatch(/postgres:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
  });

  it('wraps underlying write errors with a stable code and message', () => {
    const reportPath = path.join(tmpDir, 'report.json');
    fs.mkdirSync(reportPath, { recursive: true }); // directory in the way of a file
    try {
      writeAppendOnlyDbEnablementReport(fakeValidationResult(), reportPath);
      throw new Error('expected write to throw');
    } catch (err) {
      expect(err.message).toMatch(/Failed to write validation report/);
      expect(typeof err.code).toBe('string');
    }
  });
});
