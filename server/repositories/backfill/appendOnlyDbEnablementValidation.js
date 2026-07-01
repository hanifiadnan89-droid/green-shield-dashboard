// Read-only validation gate for enabling append-only Postgres logging for
// AI usage + Error Center. Composes existing primitives (dbConfig, dbHealth,
// migrations, repositoryFeatureFlags, file presence) into a structured
// PASS/WARN/FAIL report.
//
// Strict non-goals (enforced by the absence of side effects in this file):
//   - never mutates feature flags
//   - never applies migrations
//   - never runs backfill apply
//   - never writes to the database
//   - never includes secrets or DATABASE_URL credentials in output

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseConfig, getSafeDatabaseConfig, redactDatabaseUrl } from '../../services/db/dbConfig.js';
import { getDatabaseHealth } from '../../services/db/dbHealth.js';
import { listMigrationFiles, runMigrationStatus } from '../../services/db/migrations.js';
import { getRepositoryFeatureFlags } from '../repositoryFeatureFlags.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const REPO_DIR = path.resolve(SERVER_DIR, '..');

export const REQUIRED_MIGRATION_FILES = Object.freeze([
  '001_create_schema_migrations.sql',
  '002_create_append_only_log_tables.sql',
]);

export const REQUIRED_BACKFILL_SCRIPTS = Object.freeze([
  path.join(SERVER_DIR, 'scripts', 'backfill-append-only-logs.mjs'),
  path.join(SERVER_DIR, 'scripts', 'reconcile-append-only-logs.mjs'),
]);

export const REQUIRED_DOCS = Object.freeze([
  path.join(REPO_DIR, 'docs', 'append-only-backfill-reconciliation.md'),
  path.join(REPO_DIR, 'docs', 'ai-usage-runtime-dual-write.md'),
  path.join(REPO_DIR, 'docs', 'error-center-runtime-dual-write.md'),
  path.join(REPO_DIR, 'docs', 'postgres-migration-tooling.md'),
  path.join(REPO_DIR, 'docs', 'append-only-db-enablement-runbook.md'),
]);

export const RECOMMENDED_COMMANDS = Object.freeze([
  'npm run db:validate:append-only --prefix server',
  'npm run db:migrate:status --prefix server',
  'npm run db:migrate --prefix server',
  'npm run db:backfill:append-only --prefix server -- --domain=all',
  'npm run db:backfill:append-only --prefix server -- --domain=all --apply',
  'npm run db:reconcile:append-only --prefix server -- --domain=all',
  'npm run db:reconcile:append-only --prefix server -- --domain=all --strict',
  '# Only after every command above succeeds, set:',
  '#   DB_WRITE_AI_USAGE_ENABLED=true',
  '#   DB_WRITE_ERROR_LOG_ENABLED=true',
  '# Keep both DB_READ_* flags OFF until a future stage authorizes read cutover.',
]);

function pass(name, message, details = {}) {
  return { name, status: 'pass', message, details };
}
function warn(name, message, details = {}) {
  return { name, status: 'warn', message, details };
}
function fail(name, message, details = {}) {
  return { name, status: 'fail', message, details };
}

function rollupStatus(checks) {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}

function defaultPathExists(filePath) {
  try { return fs.existsSync(filePath); } catch { return false; }
}

function defaultMigrationsDir() {
  return path.join(SERVER_DIR, 'migrations');
}

function checkDatabaseConfigured(env) {
  const config = getDatabaseConfig(env);
  if (!config.configured) {
    return fail('database_configured', 'DATABASE_URL is not configured. Set DATABASE_URL before enabling append-only DB writes.', {
      configured: false,
    });
  }
  const redacted = redactDatabaseUrl(config.databaseUrl);
  if (redacted === '[invalid-database-url-redacted]') {
    return fail('database_configured', 'DATABASE_URL is set but could not be parsed as a URL.', {
      configured: true,
      redactedDatabaseUrl: redacted,
    });
  }
  return pass('database_configured', 'DATABASE_URL is configured.', {
    configured: true,
    redactedDatabaseUrl: redacted,
    safeConfig: getSafeDatabaseConfig(env),
  });
}

async function checkDatabaseHealth(env, healthCheck, configuredOk) {
  if (!configuredOk) {
    return warn('database_health', 'Skipped — DATABASE_URL is not configured.', { skipped: true });
  }
  try {
    const health = await healthCheck({ env });
    if (health?.status === 'healthy') {
      return pass('database_health', 'Database connectivity check passed.', {
        durationMs: health.durationMs ?? null,
        safeConfig: health.config ?? null,
      });
    }
    if (health?.status === 'disabled') {
      return warn('database_health', 'Database reports disabled (no configuration).', { health });
    }
    return fail('database_health', health?.message || 'Database connectivity check failed.', {
      errorCode: health?.errorCode || 'DB_HEALTH_CHECK_FAILED',
    });
  } catch (err) {
    return fail('database_health', `Database health check threw: ${err?.message || err}`, {
      errorCode: err?.code || 'DB_HEALTH_CHECK_THREW',
    });
  }
}

function checkMigrationFilesPresent(migrationsDir, pathExists) {
  const present = REQUIRED_MIGRATION_FILES.filter((name) => pathExists(path.join(migrationsDir, name)));
  const missing = REQUIRED_MIGRATION_FILES.filter((name) => !pathExists(path.join(migrationsDir, name)));
  if (missing.length > 0) {
    return fail('migration_files_present', `Missing required migration files: ${missing.join(', ')}`, {
      present, missing,
    });
  }
  return pass('migration_files_present', 'All required append-only migration files are present.', { present });
}

async function checkMigrationStatus(env, migrationStatusCheck, configuredOk, migrationsDir) {
  if (!configuredOk) {
    return warn('migration_status', 'Skipped — DATABASE_URL is not configured.', { skipped: true });
  }
  try {
    const status = await migrationStatusCheck({ env, migrationsDir });
    const items = Array.isArray(status) ? status : [];
    const required = new Set(REQUIRED_MIGRATION_FILES);
    const requiredItems = items.filter((item) => required.has(item.name));
    const pending = requiredItems.filter((item) => item.status !== 'applied').map((item) => item.name);
    const allItemNames = new Set(items.map((item) => item.name));
    const missing = REQUIRED_MIGRATION_FILES.filter((name) => !allItemNames.has(name));
    if (missing.length > 0) {
      return fail('migration_status', `Required migrations not visible to the runner: ${missing.join(', ')}`, {
        missing,
      });
    }
    if (pending.length > 0) {
      return warn('migration_status', `Pending migrations: ${pending.join(', ')}. Run db:migrate to apply.`, {
        pending,
      });
    }
    return pass('migration_status', 'All required append-only migrations are applied.', {
      appliedCount: requiredItems.length,
    });
  } catch (err) {
    return fail('migration_status', `Migration status check threw: ${err?.message || err}`, {
      errorCode: err?.code || 'MIGRATION_STATUS_THREW',
    });
  }
}

function checkFeatureFlags(env) {
  const flags = getRepositoryFeatureFlags(env);
  const writesEnabled = flags.dbWriteAIUsageEnabled || flags.dbWriteErrorLogEnabled;
  const prematureReadFlags = [];
  if (flags.dbReadAIUsageEnabled && !flags.dbWriteAIUsageEnabled) prematureReadFlags.push('DB_READ_AI_USAGE_ENABLED');
  if (flags.dbReadErrorLogEnabled && !flags.dbWriteErrorLogEnabled) prematureReadFlags.push('DB_READ_ERROR_LOG_ENABLED');

  if (prematureReadFlags.length > 0) {
    return fail('feature_flags',
      `Read flag(s) are ON before their corresponding write flag: ${prematureReadFlags.join(', ')}. Turn read flags OFF until validation passes and writes are stable.`,
      { flags, prematureReadFlags });
  }
  if (writesEnabled) {
    const enabled = [];
    if (flags.dbWriteAIUsageEnabled) enabled.push('DB_WRITE_AI_USAGE_ENABLED');
    if (flags.dbWriteErrorLogEnabled) enabled.push('DB_WRITE_ERROR_LOG_ENABLED');
    return warn('feature_flags',
      `DB write flag(s) already ON: ${enabled.join(', ')}. Validation should pass end-to-end before relying on these.`,
      { flags, enabled });
  }
  return pass('feature_flags', 'All append-only DB flags are OFF (safe initial state).', { flags });
}

function checkBackfillTooling(pathExists) {
  const missing = REQUIRED_BACKFILL_SCRIPTS.filter((scriptPath) => !pathExists(scriptPath));
  if (missing.length > 0) {
    return fail('backfill_tooling_present', `Missing backfill tooling: ${missing.map((p) => path.basename(p)).join(', ')}`, {
      missingBasenames: missing.map((p) => path.basename(p)),
    });
  }
  return pass('backfill_tooling_present', 'Backfill and reconciliation scripts are present.', {
    scriptBasenames: REQUIRED_BACKFILL_SCRIPTS.map((p) => path.basename(p)),
  });
}

function checkDocumentation(pathExists) {
  const missing = REQUIRED_DOCS.filter((docPath) => !pathExists(docPath));
  if (missing.length > 0) {
    return fail('documentation_present', `Missing documentation: ${missing.map((p) => path.basename(p)).join(', ')}`, {
      missingBasenames: missing.map((p) => path.basename(p)),
    });
  }
  return pass('documentation_present', 'All required runbook and dual-write docs are present.', {
    docBasenames: REQUIRED_DOCS.map((p) => path.basename(p)),
  });
}

export async function validateAppendOnlyDbEnablement(options = {}) {
  const env = options.env || process.env;
  const healthCheck = options.healthCheck || getDatabaseHealth;
  const migrationStatusCheck = options.migrationStatusCheck || runMigrationStatus;
  const pathExists = options.pathExists || defaultPathExists;
  const migrationsDir = options.migrationsDir || defaultMigrationsDir();

  const configuredCheck = checkDatabaseConfigured(env);
  const configuredOk = configuredCheck.status === 'pass';

  const checks = [
    configuredCheck,
    await checkDatabaseHealth(env, healthCheck, configuredOk),
    checkMigrationFilesPresent(migrationsDir, pathExists),
    await checkMigrationStatus(env, migrationStatusCheck, configuredOk, migrationsDir),
    checkFeatureFlags(env),
    checkBackfillTooling(pathExists),
    checkDocumentation(pathExists),
  ];

  return {
    status: rollupStatus(checks),
    checks,
    recommendedCommands: [...RECOMMENDED_COMMANDS],
  };
}

// ---------------------------------------------------------------------------
// Pre-flight report builder + writer (Stage 35).
//
// Strict non-goals: never reads process.env, never reads raw log records,
// never reads or echoes DATABASE_URL credentials. The builder only consumes
// the already-sanitized validation result.
// ---------------------------------------------------------------------------

export const REPORT_SCHEMA_VERSION = '1.0.0';
export const REPORT_TYPE = 'append_only_db_enablement_validation';
export const REPORT_GENERATED_BY = 'validate-append-only-db-enablement';

const FORBIDDEN_KEY_PATTERN = /(databaseurl|password|token|secret|cookie|bearer|api[_-]?key|authorization)/i;

function stripForbiddenKeys(value, depth = 0) {
  if (depth > 8) return value;
  if (Array.isArray(value)) return value.map((item) => stripForbiddenKeys(item, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
      out[key] = stripForbiddenKeys(raw, depth + 1);
    }
    return out;
  }
  return value;
}

function findCheck(checks, name) {
  return Array.isArray(checks) ? checks.find((check) => check && check.name === name) : null;
}

function safePass(check) {
  return Boolean(check && check.status === 'pass');
}

function buildSafeSummary(validationResult) {
  const checks = validationResult?.checks || [];
  const dbConfigured = findCheck(checks, 'database_configured');
  const flagsCheck = findCheck(checks, 'feature_flags');
  const flags = flagsCheck?.details?.flags || {};

  return {
    databaseConfigured: safePass(dbConfigured),
    writeFlagsEnabled: Boolean(flags.dbWriteAIUsageEnabled || flags.dbWriteErrorLogEnabled),
    readFlagsEnabled: Boolean(flags.dbReadAIUsageEnabled || flags.dbReadErrorLogEnabled),
    migrationChecksIncluded: Boolean(findCheck(checks, 'migration_files_present') && findCheck(checks, 'migration_status')),
    backfillToolingPresent: safePass(findCheck(checks, 'backfill_tooling_present')),
    documentationPresent: safePass(findCheck(checks, 'documentation_present')),
  };
}

export function buildAppendOnlyDbEnablementReport(validationResult, options = {}) {
  if (!validationResult || typeof validationResult !== 'object') {
    const err = new Error('validationResult is required to build a report.');
    err.code = 'REPORT_BUILDER_INVALID_INPUT';
    throw err;
  }

  const checks = Array.isArray(validationResult.checks) ? validationResult.checks : [];
  const warningCount = checks.filter((check) => check && check.status === 'warn').length;
  const failureCount = checks.filter((check) => check && check.status === 'fail').length;

  const report = {
    reportType: REPORT_TYPE,
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedBy: REPORT_GENERATED_BY,
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: validationResult.status || 'unknown',
    warningCount,
    failureCount,
    checks: checks.map((check) => ({
      name: check?.name || null,
      status: check?.status || null,
      message: check?.message || null,
      details: check?.details ?? null,
    })),
    recommendedCommands: Array.isArray(validationResult.recommendedCommands)
      ? [...validationResult.recommendedCommands]
      : [],
    safeSummary: buildSafeSummary(validationResult),
  };

  return stripForbiddenKeys(report);
}

function ensureNonEmptyPath(reportPath) {
  if (typeof reportPath !== 'string' || !reportPath.trim()) {
    const err = new Error('reportPath must be a non-empty string.');
    err.code = 'REPORT_PATH_EMPTY';
    throw err;
  }
  return reportPath.trim();
}

export function writeAppendOnlyDbEnablementReport(validationResult, reportPath, options = {}) {
  const targetPath = path.resolve(ensureNonEmptyPath(reportPath));
  const report = buildAppendOnlyDbEnablementReport(validationResult, options);
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  } catch (err) {
    const wrapped = new Error(`Failed to write validation report: ${err?.message || err}`);
    wrapped.code = err?.code || 'REPORT_WRITE_FAILED';
    wrapped.cause = err;
    throw wrapped;
  }
  return { reportPath: targetPath, report };
}

export { defaultMigrationsDir, listMigrationFiles };

export default {
  validateAppendOnlyDbEnablement,
  buildAppendOnlyDbEnablementReport,
  writeAppendOnlyDbEnablementReport,
};
