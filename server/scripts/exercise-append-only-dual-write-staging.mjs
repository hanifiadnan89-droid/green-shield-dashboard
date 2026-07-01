// Stage 40 — Staging-only append-only dual-write exercise.
//
// Proves that the Stage 32/33 recorder boundary + Stage 30 dual-write +
// Stage 30 Postgres adapters work end-to-end against a staging Postgres,
// using SYNTHETIC data only. No real AI providers, no real customer data,
// no real Gmail/Twilio, no production flags.
//
// Hard safety gates (refuse to run unless ALL pass):
//   - --confirm-staging on argv
//   - NODE_ENV !== 'production'
//   - DATABASE_URL is set
//   - DB_READ_AI_USAGE_ENABLED is not truthy
//   - DB_READ_ERROR_LOG_ENABLED is not truthy
//
// The script builds an in-process env override (DB_WRITE_*_ENABLED=true,
// DB_READ_*_ENABLED=false) and passes it to fresh recorder instances. It
// never mutates process.env, never writes to .env, never persists flags
// anywhere. Read flags stay OFF for the duration of the exercise.

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

import { createAIUsageRecorder } from '../services/ai/AIUsageRecorder.js';
import { createErrorLogRecorder } from '../services/errorLogRecorder.js';

export const STAGE40_FEATURE = 'stage40_staging_dual_write_exercise';
export const STAGE40_ERROR_CODE = 'STAGE40_STAGING_DUAL_WRITE_EXERCISE';
export const STAGE40_EXERCISE_NAME = 'append_only_dual_write_staging';

// Narrow forbidden-key pattern. We deliberately do NOT match the bare word
// "env" here because the report includes a benign `environment: "staging"`
// label. To strip raw env dumps we match `process.env` / `processEnv` /
// `process_env` explicitly.
const FORBIDDEN_KEY_PATTERN = /(database[_-]?url|password|token|secret|cookie|bearer|api[_-]?key|authorization|process[._-]?env|stack[_-]?trace|raw[_-]?prompt|raw[_-]?messages|raw[_-]?transcript)/i;

export function parseArgs(argv = []) {
  const opts = {
    confirmStaging: false,
    help: false,
    writeReport: null,
    cleanupSynthetic: false,
  };
  for (const arg of argv) {
    if (arg === '--confirm-staging') opts.confirmStaging = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--cleanup-synthetic') opts.cleanupSynthetic = true;
    else if (arg.startsWith('--write-report=')) opts.writeReport = arg.slice('--write-report='.length);
  }
  return opts;
}

export function checkSafetyGates({ env = process.env, opts = {} } = {}) {
  if (!opts.confirmStaging) {
    return { ok: false, reason: 'Refusing to run without --confirm-staging. This exercise is for staging environments only.' };
  }
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') {
    return { ok: false, reason: 'Refusing to run with NODE_ENV=production. Stage 40 is staging-only.' };
  }
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    return { ok: false, reason: 'DATABASE_URL is not configured. Point it at a staging Postgres before running the exercise.' };
  }
  const truthyValues = ['true', '1', 'on', 'yes'];
  if (truthyValues.includes(String(env.DB_READ_AI_USAGE_ENABLED || '').trim().toLowerCase())) {
    return { ok: false, reason: 'Refusing to run: DB_READ_AI_USAGE_ENABLED is ON. Read flags must stay OFF for the dual-write exercise.' };
  }
  if (truthyValues.includes(String(env.DB_READ_ERROR_LOG_ENABLED || '').trim().toLowerCase())) {
    return { ok: false, reason: 'Refusing to run: DB_READ_ERROR_LOG_ENABLED is ON. Read flags must stay OFF for the dual-write exercise.' };
  }
  return { ok: true, reason: null };
}

export function buildExerciseEnv(processEnv = process.env) {
  // Returns a NEW object. Never mutates the input.
  return {
    ...processEnv,
    DB_WRITE_AI_USAGE_ENABLED: 'true',
    DB_WRITE_ERROR_LOG_ENABLED: 'true',
    DB_READ_AI_USAGE_ENABLED: 'false',
    DB_READ_ERROR_LOG_ENABLED: 'false',
  };
}

export function buildSyntheticAIUsageEntry() {
  return {
    endpoint: STAGE40_FEATURE,
    feature: STAGE40_FEATURE,
    provider: 'synthetic',
    model: 'synthetic-validation-model',
    durationMs: 1,
    inputSize: 1,
    outputSize: 1,
    success: true,
    source: STAGE40_FEATURE,
    metadata: {
      exercise: true,
      stage: 40,
      environment: 'staging',
      synthetic: true,
      exerciseName: STAGE40_EXERCISE_NAME,
    },
  };
}

export function buildSyntheticErrorEntry() {
  return {
    // errorLogService.SOURCES is a fixed allow-list; 'backend' is the safe
    // catch-all. Provenance lives in module + errorCode + rawMetadata so the
    // record is obviously synthetic and grep-friendly.
    source: 'backend',
    severity: 'low',
    status: 'new',
    module: STAGE40_FEATURE,
    endpoint: STAGE40_FEATURE,
    errorCode: STAGE40_ERROR_CODE,
    message: 'Synthetic staging append-only dual-write validation event',
    rawMetadata: {
      exercise: true,
      stage: 40,
      environment: 'staging',
      synthetic: true,
      exerciseName: STAGE40_EXERCISE_NAME,
    },
  };
}

function wrapPostgresWithTracker(repo, label) {
  const tracker = [];
  const wrapped = { ...repo };
  if (typeof repo.recordUsage === 'function') {
    wrapped.recordUsage = (entry) => {
      const p = Promise.resolve().then(() => repo.recordUsage(entry));
      tracker.push(p);
      return p;
    };
  }
  if (typeof repo.createError === 'function') {
    wrapped.createError = (entry) => {
      const p = Promise.resolve().then(() => repo.createError(entry));
      tracker.push(p);
      return p;
    };
  }
  return { repo: wrapped, tracker, label };
}

function stripForbidden(value, depth = 0) {
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

async function verifyAIUsageIncludes(postgresRepo, id) {
  const result = await postgresRepo.listUsage({ feature: STAGE40_FEATURE, limit: 50 });
  const rows = Array.isArray(result) ? result : (result?.entries || result?.rows || []);
  return rows.some((row) => row && row.id === id);
}

async function verifyErrorLogById(postgresRepo, id) {
  const row = await postgresRepo.getErrorById(id);
  return Boolean(row && row.id === id);
}

async function waitForTrackedWrite(tracker, { timeoutMs = 2000, pollMs = 25 } = {}) {
  // The recorder's Postgres write runs inside a Promise.resolve().then(...) chain,
  // so the tracker is empty at the moment recordAIUsage / createError returns.
  // Poll bounded until the wrapper's recordUsage / createError lands and pushes
  // its promise onto the tracker, then let the caller await it.
  const deadline = Date.now() + timeoutMs;
  while (tracker.length === 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return tracker.length > 0;
}

function safeErrorMessage(err) {
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

export async function runExercise({
  env,
  aiPostgresRepository,
  errorPostgresRepository,
  aiRecorderFactory = createAIUsageRecorder,
  errorRecorderFactory = createErrorLogRecorder,
  logger = console,
} = {}) {
  const aiWrap = wrapPostgresWithTracker(aiPostgresRepository, 'ai-usage');
  const errorWrap = wrapPostgresWithTracker(errorPostgresRepository, 'error-log');

  const aiRecorder = aiRecorderFactory({
    env,
    postgresRepository: aiWrap.repo,
    logger,
  });
  const errorRecorder = errorRecorderFactory({
    env,
    postgresRepository: errorWrap.repo,
    logger,
  });

  const aiResult = { currentStoreWritten: false, postgresWritten: false, syntheticOnly: true, id: null, reason: null, error: null };
  const errorResult = { currentStoreWritten: false, postgresWritten: false, syntheticOnly: true, id: null, reason: null, error: null };

  // --- AI usage path -------------------------------------------------------
  try {
    const aiEntry = buildSyntheticAIUsageEntry();
    const currentRecord = await Promise.resolve(aiRecorder.recordAIUsage(aiEntry));
    if (currentRecord && currentRecord.id) {
      aiResult.currentStoreWritten = true;
      aiResult.id = currentRecord.id;
      const observed = await waitForTrackedWrite(aiWrap.tracker);
      if (!observed) {
        aiResult.reason = 'postgres_write_not_observed';
      } else {
        const settled = await Promise.allSettled(aiWrap.tracker);
        const rejected = settled.find((s) => s.status === 'rejected');
        if (rejected) {
          aiResult.reason = 'postgres_write_failed';
          aiResult.error = safeErrorMessage(rejected.reason);
        } else {
          try {
            const found = await verifyAIUsageIncludes(aiPostgresRepository, currentRecord.id);
            if (found) {
              aiResult.postgresWritten = true;
            } else {
              aiResult.reason = 'postgres_verification_not_found';
            }
          } catch (verifyErr) {
            aiResult.reason = 'verification_query_failed';
            aiResult.error = safeErrorMessage(verifyErr);
          }
        }
      }
    } else {
      aiResult.reason = 'current_store_write_missing';
    }
  } catch (err) {
    aiResult.reason = aiResult.reason || 'current_store_write_failed';
    aiResult.error = safeErrorMessage(err) || 'AI usage exercise failed';
  }

  // --- Error Center path ---------------------------------------------------
  try {
    const errorEntry = buildSyntheticErrorEntry();
    const currentRecord = await Promise.resolve(errorRecorder.createError(errorEntry));
    if (currentRecord && currentRecord.id) {
      errorResult.currentStoreWritten = true;
      errorResult.id = currentRecord.id;
      const observed = await waitForTrackedWrite(errorWrap.tracker);
      if (!observed) {
        errorResult.reason = 'postgres_write_not_observed';
      } else {
        const settled = await Promise.allSettled(errorWrap.tracker);
        const rejected = settled.find((s) => s.status === 'rejected');
        if (rejected) {
          errorResult.reason = 'postgres_write_failed';
          errorResult.error = safeErrorMessage(rejected.reason);
        } else {
          try {
            const found = await verifyErrorLogById(errorPostgresRepository, currentRecord.id);
            if (found) {
              errorResult.postgresWritten = true;
            } else {
              errorResult.reason = 'postgres_verification_not_found';
            }
          } catch (verifyErr) {
            errorResult.reason = 'verification_query_failed';
            errorResult.error = safeErrorMessage(verifyErr);
          }
        }
      }
    } else {
      errorResult.reason = 'current_store_write_missing';
    }
  } catch (err) {
    errorResult.reason = errorResult.reason || 'current_store_write_failed';
    errorResult.error = safeErrorMessage(err) || 'Error Center exercise failed';
  }

  const overallPass = aiResult.currentStoreWritten
    && aiResult.postgresWritten
    && errorResult.currentStoreWritten
    && errorResult.postgresWritten;

  return {
    status: overallPass ? 'pass' : 'fail',
    environment: 'staging',
    exercise: STAGE40_EXERCISE_NAME,
    writeFlagsUsed: {
      dbWriteAIUsageEnabled: true,
      dbWriteErrorLogEnabled: true,
      dbReadAIUsageEnabled: false,
      dbReadErrorLogEnabled: false,
    },
    aiUsage: stripForbidden(aiResult),
    errorLog: stripForbidden(errorResult),
  };
}

async function defaultAIPostgresFactory(env) {
  const { createAIUsagePostgresRepository } = await import('../repositories/postgres/aiUsagePostgresRepository.js');
  return createAIUsagePostgresRepository({ env });
}

async function defaultErrorPostgresFactory(env) {
  const { createErrorLogPostgresRepository } = await import('../repositories/postgres/errorLogPostgresRepository.js');
  return createErrorLogPostgresRepository({ env });
}

function buildSanitizedReport(summary, { startedAt, completedAt }) {
  const stripped = stripForbidden(summary);
  return {
    reportType: 'append_only_dual_write_staging_exercise',
    schemaVersion: '1.0.0',
    generatedBy: 'exercise-append-only-dual-write-staging',
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

function printHelp(logger = console) {
  logger.log('Usage: node scripts/exercise-append-only-dual-write-staging.mjs --confirm-staging [--write-report=<path>] [--help]');
  logger.log('');
  logger.log('Runs a staging-only append-only dual-write exercise for AI usage + Error Center logs.');
  logger.log('Uses SYNTHETIC data only. Never calls real AI providers, Gmail, or Twilio.');
  logger.log('');
  logger.log('Required:');
  logger.log('  --confirm-staging        Confirm you are running against staging Postgres only.');
  logger.log('');
  logger.log('Refuses to run if:');
  logger.log('  - NODE_ENV=production');
  logger.log('  - DATABASE_URL is missing');
  logger.log('  - DB_READ_AI_USAGE_ENABLED=true');
  logger.log('  - DB_READ_ERROR_LOG_ENABLED=true');
  logger.log('');
  logger.log('Options:');
  logger.log('  --write-report=<path>    Write a sanitized JSON exercise report to <path>.');
  logger.log('                           Opt-in only. Creates parent directories as needed.');
  logger.log('  --help, -h               Show this help and exit.');
  logger.log('');
  logger.log('Strict non-goals:');
  logger.log('  - never persists flag changes to the environment or .env');
  logger.log('  - never modifies production data, production flags, or production secrets');
  logger.log('  - never enables read flags');
  logger.log('  - never deletes the synthetic rows (audit evidence remains in both stores)');
}

export async function main(argv = process.argv.slice(2), logger = console, {
  envSource = process.env,
  aiPostgresFactory = defaultAIPostgresFactory,
  errorPostgresFactory = defaultErrorPostgresFactory,
  recorderFactories = { aiRecorderFactory: createAIUsageRecorder, errorRecorderFactory: createErrorLogRecorder },
} = {}) {
  const opts = parseArgs(argv);
  if (opts.help) {
    printHelp(logger);
    return { ok: true, status: 'help' };
  }

  const gate = checkSafetyGates({ env: envSource, opts });
  if (!gate.ok) {
    logger.error(gate.reason);
    process.exitCode = 1;
    return { ok: false, status: 'refused', reason: gate.reason };
  }

  logger.log('Stage 40 — Staging-only append-only dual-write exercise.');
  logger.log('Synthetic data only. Read flags stay OFF. Process env is NOT mutated.');

  const envSnapshotBefore = JSON.stringify({
    DB_WRITE_AI_USAGE_ENABLED: envSource.DB_WRITE_AI_USAGE_ENABLED,
    DB_WRITE_ERROR_LOG_ENABLED: envSource.DB_WRITE_ERROR_LOG_ENABLED,
    DB_READ_AI_USAGE_ENABLED: envSource.DB_READ_AI_USAGE_ENABLED,
    DB_READ_ERROR_LOG_ENABLED: envSource.DB_READ_ERROR_LOG_ENABLED,
  });

  const exerciseEnv = buildExerciseEnv(envSource);
  const startedAt = new Date().toISOString();

  let summary;
  try {
    const aiPostgresRepository = await aiPostgresFactory(exerciseEnv);
    const errorPostgresRepository = await errorPostgresFactory(exerciseEnv);
    summary = await runExercise({
      env: exerciseEnv,
      aiPostgresRepository,
      errorPostgresRepository,
      aiRecorderFactory: recorderFactories.aiRecorderFactory,
      errorRecorderFactory: recorderFactories.errorRecorderFactory,
      logger,
    });
  } catch (err) {
    summary = {
      status: 'fail',
      environment: 'staging',
      exercise: STAGE40_EXERCISE_NAME,
      writeFlagsUsed: {
        dbWriteAIUsageEnabled: true,
        dbWriteErrorLogEnabled: true,
        dbReadAIUsageEnabled: false,
        dbReadErrorLogEnabled: false,
      },
      aiUsage: { currentStoreWritten: false, postgresWritten: false, syntheticOnly: true, error: err?.code || err?.message || 'exercise_threw' },
      errorLog: { currentStoreWritten: false, postgresWritten: false, syntheticOnly: true, error: err?.code || err?.message || 'exercise_threw' },
    };
  }
  const completedAt = new Date().toISOString();

  const envSnapshotAfter = JSON.stringify({
    DB_WRITE_AI_USAGE_ENABLED: envSource.DB_WRITE_AI_USAGE_ENABLED,
    DB_WRITE_ERROR_LOG_ENABLED: envSource.DB_WRITE_ERROR_LOG_ENABLED,
    DB_READ_AI_USAGE_ENABLED: envSource.DB_READ_AI_USAGE_ENABLED,
    DB_READ_ERROR_LOG_ENABLED: envSource.DB_READ_ERROR_LOG_ENABLED,
  });
  const processEnvUnchanged = envSnapshotBefore === envSnapshotAfter;

  logger.log(JSON.stringify(summary, null, 2));
  logger.log(`process.env mutation guard: ${processEnvUnchanged ? 'OK (unchanged)' : 'VIOLATED'}`);

  let reportResult = null;
  if (opts.writeReport) {
    const report = buildSanitizedReport(summary, { startedAt, completedAt });
    reportResult = writeReport(opts.writeReport, report, logger);
    if (!reportResult.ok) {
      process.exitCode = 1;
      return { ok: false, status: 'report_write_failed', summary };
    }
  }

  if (!processEnvUnchanged) {
    process.exitCode = 1;
    return { ok: false, status: 'env_mutated', summary };
  }

  if (summary.status !== 'pass') {
    process.exitCode = 1;
    return { ok: false, status: 'exercise_failed', summary, reportPath: reportResult?.path || null };
  }

  return { ok: true, status: 'exercise_passed', summary, reportPath: reportResult?.path || null };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  });
}
