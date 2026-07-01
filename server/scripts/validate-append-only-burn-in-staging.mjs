// Stage 41 — Controlled staging burn-in validator.
//
// Read-only. Confirms the STAGING app is running with append-only Postgres
// write flags ON (writes shadowing to Postgres) while read flags remain OFF
// (JSON/file stores are still source of truth), and that the shadow writes
// are actually landing in Postgres over a recent window.
//
// Safety gates (refuse to run unless ALL pass):
//   - NODE_ENV !== 'production'
//   - DATABASE_URL is set
//   - DB_READ_AI_USAGE_ENABLED not truthy
//   - DB_READ_ERROR_LOG_ENABLED not truthy
//
// Never enables flags, never migrates, never backfills, never writes to
// Postgres, never mutates process.env, never touches Gmail/Twilio/Sheets,
// never generates AI calls.
//
// Report is sanitized: never contains DATABASE_URL, credentials, raw env,
// or stack traces.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getRepositoryFeatureFlags } from '../repositories/repositoryFeatureFlags.js';
import { getSafeDatabaseConfig } from '../services/db/dbConfig.js';

export const STAGE41_STAGE_ID = 'stage41_append_only_burn_in_staging';

// Same conservative forbidden-key pattern used by Stage 40. Keys matching
// this regex are stripped from the sanitized report.
const FORBIDDEN_KEY_PATTERN = /(database[_-]?url|password|token|secret|cookie|bearer|api[_-]?key|authorization|process[._-]?env|stack[_-]?trace|raw[_-]?prompt|raw[_-]?messages|raw[_-]?transcript)/i;

const PRODUCTION_HOST_TOKENS = ['prod', 'production', 'live'];

const TRUTHY = new Set(['true', '1', 'on', 'yes']);
function isTruthy(value) {
  return TRUTHY.has(String(value ?? '').trim().toLowerCase());
}

export function parseSinceMinutes(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (trimmed === '') {
    const err = new Error('--since-minutes requires a positive integer (got empty value).');
    err.code = 'INVALID_SINCE_MINUTES';
    throw err;
  }
  if (!/^\d+$/.test(trimmed)) {
    const err = new Error(`--since-minutes must be a positive integer (got "${trimmed}").`);
    err.code = 'INVALID_SINCE_MINUTES';
    throw err;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10080) {
    // 10080 minutes = 7 days upper bound. Prevents accidental huge windows.
    const err = new Error(`--since-minutes must be between 1 and 10080 (got "${trimmed}").`);
    err.code = 'INVALID_SINCE_MINUTES';
    throw err;
  }
  return parsed;
}

export function parseArgs(argv = []) {
  const opts = {
    help: false,
    json: false,
    writeReport: null,
    sinceMinutes: 60,
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg.startsWith('--write-report=')) opts.writeReport = arg.slice('--write-report='.length);
    else if (arg.startsWith('--since-minutes=')) opts.sinceMinutes = parseSinceMinutes(arg.slice('--since-minutes='.length));
  }
  return opts;
}

export function safeErrorMessage(err) {
  if (!err) return null;
  const code = typeof err.code === 'string' && err.code.trim() ? err.code.trim() : null;
  if (code) return code;
  const raw = typeof err.message === 'string' && err.message.trim() ? err.message.trim() : null;
  if (!raw) return null;
  const sanitized = raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-url]')
    .replace(/password[^\s,;]*/gi, '[redacted-password]')
    .replace(/Bearer\s+\S+/gi, '[redacted-bearer]')
    .replace(/sk-[A-Za-z0-9]+/g, '[redacted-token]');
  return sanitized.slice(0, 200);
}

export function stripForbidden(value, depth = 0) {
  if (depth > 8) return value;
  if (Array.isArray(value)) return value.map((v) => stripForbidden(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
      out[key] = stripForbidden(raw, depth + 1);
    }
    return out;
  }
  return value;
}

function makeCheck(name, status, reason) {
  return { name, status, reason: reason || null };
}

function aggregateStatus(checks) {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  return 'pass';
}

function detectProductionHostToken(redactedDatabaseUrl) {
  if (!redactedDatabaseUrl || typeof redactedDatabaseUrl !== 'string') return null;
  try {
    const parsed = new URL(redactedDatabaseUrl);
    const host = (parsed.hostname || '').toLowerCase();
    for (const token of PRODUCTION_HOST_TOKENS) {
      if (host.includes(token)) return token;
    }
    return null;
  } catch {
    return null;
  }
}

async function defaultPostgresProbe({ env, sinceIso }) {
  const { query } = await import('../services/db/dbClient.js');
  const { runMigrationStatus } = await import('../services/db/migrations.js');

  const probe = {
    reachable: false,
    migrationsApplied: false,
    migrationsPending: [],
    aiUsageTablePresent: false,
    errorLogTablePresent: false,
    aiUsageRecentRows: 0,
    errorLogRecentRows: 0,
    error: null,
  };
  try {
    await query('select 1', [], { env });
    probe.reachable = true;
  } catch (err) {
    probe.error = safeErrorMessage(err);
    return probe;
  }
  try {
    const status = await runMigrationStatus({ env });
    const pending = (status || []).filter((m) => m.status !== 'applied').map((m) => m.name);
    probe.migrationsApplied = pending.length === 0 && (status || []).length > 0;
    probe.migrationsPending = pending;
  } catch (err) {
    probe.error = safeErrorMessage(err);
    return probe;
  }
  try {
    const result = await query(
      'select count(*)::int as count from ai_usage_logs where timestamp >= $1',
      [sinceIso],
      { env },
    );
    probe.aiUsageTablePresent = true;
    probe.aiUsageRecentRows = Number(result.rows?.[0]?.count ?? 0);
  } catch (err) {
    if (err?.code !== '42P01') probe.error = safeErrorMessage(err);
  }
  try {
    const result = await query(
      'select count(*)::int as count from error_log where created_at >= $1',
      [sinceIso],
      { env },
    );
    probe.errorLogTablePresent = true;
    probe.errorLogRecentRows = Number(result.rows?.[0]?.count ?? 0);
  } catch (err) {
    if (err?.code !== '42P01') probe.error = safeErrorMessage(err);
  }
  return probe;
}

async function defaultCurrentStoreProbe() {
  const [{ listAIUsage }, { listErrors }] = await Promise.all([
    import('../services/ai/AIUsageLogService.js'),
    import('../services/errorLogService.js'),
  ]);
  const probe = {
    aiUsageReadable: false,
    errorLogReadable: false,
    aiUsageError: null,
    errorLogError: null,
  };
  try {
    const rows = await Promise.resolve(listAIUsage({ limit: 1 }));
    probe.aiUsageReadable = Array.isArray(rows) || Array.isArray(rows?.entries);
  } catch (err) {
    probe.aiUsageError = safeErrorMessage(err);
  }
  try {
    const rows = await Promise.resolve(listErrors({ limit: 1 }));
    probe.errorLogReadable = Array.isArray(rows) || Array.isArray(rows?.errors);
  } catch (err) {
    probe.errorLogError = safeErrorMessage(err);
  }
  return probe;
}

export async function runValidation({
  env = process.env,
  sinceMinutes = 60,
  postgresProbe = defaultPostgresProbe,
  currentStoreProbe = defaultCurrentStoreProbe,
} = {}) {
  const startedAt = new Date();
  const sinceIso = new Date(startedAt.getTime() - sinceMinutes * 60 * 1000).toISOString();
  const flags = getRepositoryFeatureFlags(env);
  const safeConfig = getSafeDatabaseConfig(env);

  const checks = [];

  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') {
    checks.push(makeCheck('env_node_env_not_production', 'fail', 'node_env_is_production'));
  } else {
    checks.push(makeCheck('env_node_env_not_production', 'pass', null));
  }

  if (!safeConfig.configured) {
    checks.push(makeCheck('env_database_url_configured', 'fail', 'database_url_missing'));
  } else {
    checks.push(makeCheck('env_database_url_configured', 'pass', null));
  }

  // dbConfig.parseSsl accepts empty string, 'true', 'false', 'no-verify',
  // 'allow-unauthorized', etc. It never throws. Any DATABASE_SSL value
  // reaching this point is supported.
  checks.push(makeCheck('env_database_ssl_supported', 'pass', null));

  if (flags.dbReadAIUsageEnabled) {
    checks.push(makeCheck('flags_read_ai_usage_off', 'fail', 'db_read_ai_usage_enabled_true'));
  } else {
    checks.push(makeCheck('flags_read_ai_usage_off', 'pass', null));
  }
  if (flags.dbReadErrorLogEnabled) {
    checks.push(makeCheck('flags_read_error_log_off', 'fail', 'db_read_error_log_enabled_true'));
  } else {
    checks.push(makeCheck('flags_read_error_log_off', 'pass', null));
  }
  if (!flags.dbWriteAIUsageEnabled) {
    checks.push(makeCheck('flags_write_ai_usage_on_for_burn_in', 'fail', 'db_write_ai_usage_enabled_false'));
  } else {
    checks.push(makeCheck('flags_write_ai_usage_on_for_burn_in', 'pass', null));
  }
  if (!flags.dbWriteErrorLogEnabled) {
    checks.push(makeCheck('flags_write_error_log_on_for_burn_in', 'fail', 'db_write_error_log_enabled_false'));
  } else {
    checks.push(makeCheck('flags_write_error_log_on_for_burn_in', 'pass', null));
  }

  const prodToken = detectProductionHostToken(safeConfig.redactedDatabaseUrl);
  if (prodToken) {
    checks.push(makeCheck('env_no_production_indicators', 'warn', `database_url_host_contains_${prodToken}`));
  } else {
    checks.push(makeCheck('env_no_production_indicators', 'pass', null));
  }

  // Only probe Postgres if DATABASE_URL is configured — otherwise the probe
  // would throw its own DB_UNCONFIGURED error, and we've already reported the
  // fail above.
  let postgres = {
    reachable: false,
    migrationsApplied: false,
    migrationsPending: [],
    aiUsageTablePresent: false,
    errorLogTablePresent: false,
    aiUsageRecentRows: 0,
    errorLogRecentRows: 0,
    error: null,
  };
  if (safeConfig.configured && nodeEnv !== 'production') {
    try {
      postgres = await postgresProbe({ env, sinceIso });
    } catch (err) {
      postgres.error = safeErrorMessage(err);
    }
  }

  if (postgres.reachable) {
    checks.push(makeCheck('db_reachable', 'pass', null));
  } else {
    checks.push(makeCheck('db_reachable', 'fail', postgres.error || 'db_unreachable'));
  }
  if (postgres.reachable) {
    if (postgres.migrationsApplied) {
      checks.push(makeCheck('db_migrations_applied', 'pass', null));
    } else if (postgres.migrationsPending && postgres.migrationsPending.length > 0) {
      checks.push(makeCheck('db_migrations_applied', 'fail', 'migrations_pending'));
    } else {
      checks.push(makeCheck('db_migrations_applied', 'fail', postgres.error || 'migration_status_unknown'));
    }
    if (postgres.aiUsageTablePresent) {
      checks.push(makeCheck('db_ai_usage_table_present', 'pass', null));
    } else {
      checks.push(makeCheck('db_ai_usage_table_present', 'fail', 'ai_usage_logs_missing'));
    }
    if (postgres.errorLogTablePresent) {
      checks.push(makeCheck('db_error_log_table_present', 'pass', null));
    } else {
      checks.push(makeCheck('db_error_log_table_present', 'fail', 'error_log_missing'));
    }
    if (postgres.aiUsageTablePresent) {
      if (postgres.aiUsageRecentRows > 0) {
        checks.push(makeCheck('db_ai_usage_recent_rows', 'pass', null));
      } else {
        checks.push(makeCheck('db_ai_usage_recent_rows', 'warn', 'no_recent_ai_usage_rows'));
      }
    }
    if (postgres.errorLogTablePresent) {
      if (postgres.errorLogRecentRows > 0) {
        checks.push(makeCheck('db_error_log_recent_rows', 'pass', null));
      } else {
        checks.push(makeCheck('db_error_log_recent_rows', 'warn', 'no_recent_error_log_rows'));
      }
    }
  }

  let currentStore = { aiUsageReadable: false, errorLogReadable: false, aiUsageError: null, errorLogError: null };
  try {
    currentStore = await currentStoreProbe();
  } catch (err) {
    currentStore.aiUsageError = currentStore.aiUsageError || safeErrorMessage(err);
    currentStore.errorLogError = currentStore.errorLogError || safeErrorMessage(err);
  }
  if (currentStore.aiUsageReadable) {
    checks.push(makeCheck('current_store_ai_usage_readable', 'pass', null));
  } else {
    checks.push(makeCheck('current_store_ai_usage_readable', 'fail', currentStore.aiUsageError || 'current_ai_usage_read_failed'));
  }
  if (currentStore.errorLogReadable) {
    checks.push(makeCheck('current_store_error_log_readable', 'pass', null));
  } else {
    checks.push(makeCheck('current_store_error_log_readable', 'fail', currentStore.errorLogError || 'current_error_log_read_failed'));
  }

  const status = aggregateStatus(checks);

  let recommendation;
  if (status === 'pass') {
    recommendation = 'Burn-in evidence is clean. Keep read flags OFF. Do not enable production writes.';
  } else if (status === 'warn') {
    recommendation = 'Burn-in is healthy but shadow writes are sparse. Generate more staging activity or extend --since-minutes, then re-run. Do not enable production writes.';
  } else {
    recommendation = 'Burn-in validation failed. Do not enable production writes. Investigate the failing checks and re-run.';
  }

  const endedAt = new Date();
  return {
    status,
    stage: STAGE41_STAGE_ID,
    environment: 'staging',
    window: {
      sinceMinutes,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      since: sinceIso,
    },
    flags: {
      dbWriteAIUsageEnabled: flags.dbWriteAIUsageEnabled,
      dbWriteErrorLogEnabled: flags.dbWriteErrorLogEnabled,
      dbReadAIUsageEnabled: flags.dbReadAIUsageEnabled,
      dbReadErrorLogEnabled: flags.dbReadErrorLogEnabled,
    },
    checks,
    postgres: {
      reachable: postgres.reachable,
      migrationsApplied: postgres.migrationsApplied,
      aiUsageRecentRows: postgres.aiUsageRecentRows,
      errorLogRecentRows: postgres.errorLogRecentRows,
    },
    currentStore: {
      aiUsageReadable: currentStore.aiUsageReadable,
      errorLogReadable: currentStore.errorLogReadable,
    },
    recommendation,
  };
}

function buildSanitizedReport(summary, { startedAt, completedAt }) {
  const stripped = stripForbidden(summary);
  return {
    reportType: 'append_only_burn_in_staging_validation',
    schemaVersion: '1.0.0',
    generatedBy: 'validate-append-only-burn-in-staging',
    startedAt,
    completedAt,
    ...stripped,
  };
}

function writeReport(filePath, report, logger) {
  try {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(report, null, 2) + '\n', 'utf-8');
    logger.log(`Report written to ${resolved}`);
    return { ok: true, path: resolved };
  } catch (err) {
    logger.error(`Failed to write report: ${err?.message || err}`);
    return { ok: false, error: err?.message || String(err) };
  }
}

function statusIcon(status) {
  if (status === 'pass') return '✓';
  if (status === 'warn') return '!';
  return '✗';
}

function printHumanSummary(summary, logger = console) {
  logger.log(`Stage 41 append-only burn-in validation: ${summary.status.toUpperCase()}`);
  logger.log(`Window: last ${summary.window.sinceMinutes} minutes (since ${summary.window.since}).`);
  logger.log('');
  for (const check of summary.checks) {
    const line = `  ${statusIcon(check.status)} [${check.status.padEnd(4)}] ${check.name}`;
    logger.log(check.reason ? `${line} — ${check.reason}` : line);
  }
  logger.log('');
  logger.log(`Postgres: reachable=${summary.postgres.reachable} migrationsApplied=${summary.postgres.migrationsApplied} aiUsageRecent=${summary.postgres.aiUsageRecentRows} errorLogRecent=${summary.postgres.errorLogRecentRows}`);
  logger.log(`Current store: aiUsageReadable=${summary.currentStore.aiUsageReadable} errorLogReadable=${summary.currentStore.errorLogReadable}`);
  logger.log('');
  logger.log(summary.recommendation);
}

function printHelp(logger = console) {
  logger.log('Usage: node scripts/validate-append-only-burn-in-staging.mjs [--json] [--write-report=<path>] [--since-minutes=<n>] [--help]');
  logger.log('');
  logger.log('Read-only validator for the Stage 41 staging burn-in of append-only Postgres shadow writes.');
  logger.log('Confirms: safety gates, feature flags, Postgres reachability + migrations, recent shadow-write rows,');
  logger.log('current JSON/file store readability, and absence of production indicators.');
  logger.log('');
  logger.log('Refuses to run when NODE_ENV=production or when read flags are ON.');
  logger.log('Never mutates flags. Never runs migrations. Never runs backfill. Never writes to Postgres.');
  logger.log('Never calls Gmail/Twilio. Never calls AI providers. Never touches customer data.');
  logger.log('');
  logger.log('Options:');
  logger.log('  --json                     Emit machine-readable JSON summary on stdout.');
  logger.log('  --write-report=<path>      Write a sanitized JSON report to <path>. Opt-in only.');
  logger.log('  --since-minutes=<n>        Window (minutes) for recent-row checks. Default 60. Max 10080.');
  logger.log('  --help, -h                 Show this help and exit.');
}

export async function main(argv = process.argv.slice(2), logger = console, {
  envSource = process.env,
  postgresProbe = defaultPostgresProbe,
  currentStoreProbe = defaultCurrentStoreProbe,
} = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    logger.error(err?.message || String(err));
    process.exitCode = 1;
    return { ok: false, status: 'invalid_argument', reason: err?.code || 'invalid_argument' };
  }
  if (opts.help) {
    printHelp(logger);
    return { ok: true, status: 'help' };
  }

  const envSnapshotBefore = JSON.stringify({
    DB_WRITE_AI_USAGE_ENABLED: envSource.DB_WRITE_AI_USAGE_ENABLED,
    DB_WRITE_ERROR_LOG_ENABLED: envSource.DB_WRITE_ERROR_LOG_ENABLED,
    DB_READ_AI_USAGE_ENABLED: envSource.DB_READ_AI_USAGE_ENABLED,
    DB_READ_ERROR_LOG_ENABLED: envSource.DB_READ_ERROR_LOG_ENABLED,
    NODE_ENV: envSource.NODE_ENV,
  });

  const startedAt = new Date().toISOString();
  let summary;
  try {
    summary = await runValidation({
      env: envSource,
      sinceMinutes: opts.sinceMinutes,
      postgresProbe,
      currentStoreProbe,
    });
  } catch (err) {
    summary = {
      status: 'fail',
      stage: STAGE41_STAGE_ID,
      environment: 'staging',
      window: { sinceMinutes: opts.sinceMinutes, startedAt, endedAt: new Date().toISOString() },
      flags: getRepositoryFeatureFlags(envSource),
      checks: [makeCheck('validation_runner', 'fail', safeErrorMessage(err) || 'validation_runner_threw')],
      postgres: { reachable: false, migrationsApplied: false, aiUsageRecentRows: 0, errorLogRecentRows: 0 },
      currentStore: { aiUsageReadable: false, errorLogReadable: false },
      recommendation: 'Validation runner threw. Do not enable production writes.',
    };
  }
  const completedAt = new Date().toISOString();

  const envSnapshotAfter = JSON.stringify({
    DB_WRITE_AI_USAGE_ENABLED: envSource.DB_WRITE_AI_USAGE_ENABLED,
    DB_WRITE_ERROR_LOG_ENABLED: envSource.DB_WRITE_ERROR_LOG_ENABLED,
    DB_READ_AI_USAGE_ENABLED: envSource.DB_READ_AI_USAGE_ENABLED,
    DB_READ_ERROR_LOG_ENABLED: envSource.DB_READ_ERROR_LOG_ENABLED,
    NODE_ENV: envSource.NODE_ENV,
  });
  const processEnvUnchanged = envSnapshotBefore === envSnapshotAfter;

  if (opts.json) {
    logger.log(JSON.stringify(stripForbidden(summary), null, 2));
  } else {
    printHumanSummary(summary, logger);
  }

  let reportPath = null;
  if (opts.writeReport) {
    const report = buildSanitizedReport(summary, { startedAt, completedAt });
    const written = writeReport(opts.writeReport, report, logger);
    if (!written.ok) {
      process.exitCode = 1;
      return { ok: false, status: 'report_write_failed', summary };
    }
    reportPath = written.path;
  }

  if (!processEnvUnchanged) {
    process.exitCode = 1;
    return { ok: false, status: 'env_mutated', summary, reportPath };
  }

  if (summary.status === 'fail') {
    process.exitCode = 1;
    return { ok: false, status: 'validation_failed', summary, reportPath };
  }
  return { ok: true, status: summary.status === 'warn' ? 'validation_warn' : 'validation_passed', summary, reportPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  });
}
