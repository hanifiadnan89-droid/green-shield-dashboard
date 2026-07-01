// Read-only validation gate. Confirms whether the environment is ready to
// enable append-only Postgres logging for AI usage + Error Center. Does not
// mutate flags, run migrations, or write to Postgres.
//
// Usage:
//   npm run db:validate:append-only --prefix server
//   npm run db:validate:append-only --prefix server -- --json
//   npm run db:validate:append-only --prefix server -- --write-report=./reports/append-only-validation.json
//   npm run db:validate:append-only --prefix server -- --json --write-report=./reports/append-only-validation.json
//
// Exit codes:
//   0 = pass or warn (validation OK and, if requested, report written)
//   1 = fail (validation failed) OR report write failed

import { fileURLToPath } from 'url';
import {
  validateAppendOnlyDbEnablement,
  writeAppendOnlyDbEnablementReport,
} from '../repositories/backfill/appendOnlyDbEnablementValidation.js';

function parseThresholdFlag(rawValue, flagName) {
  const trimmed = String(rawValue ?? '').trim();
  if (trimmed === '') {
    const err = new Error(`${flagName} requires a non-negative integer (got empty value).`);
    err.code = 'INVALID_THRESHOLD';
    throw err;
  }
  if (!/^-?\d+$/.test(trimmed)) {
    const err = new Error(`${flagName} must be a non-negative integer (got "${trimmed}").`);
    err.code = 'INVALID_THRESHOLD';
    throw err;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const err = new Error(`${flagName} must be a non-negative integer (got "${trimmed}").`);
    err.code = 'INVALID_THRESHOLD';
    throw err;
  }
  return parsed;
}

function parseArgs(argv) {
  const opts = {
    json: false,
    help: false,
    writeReport: null,
    maxFailureCount: null,
    maxWarningCount: null,
  };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--write-report=')) opts.writeReport = arg.slice('--write-report='.length);
    else if (arg.startsWith('--max-failure-count=')) opts.maxFailureCount = parseThresholdFlag(arg.slice('--max-failure-count='.length), '--max-failure-count');
    else if (arg.startsWith('--max-warning-count=')) opts.maxWarningCount = parseThresholdFlag(arg.slice('--max-warning-count='.length), '--max-warning-count');
  }
  return opts;
}

function countByStatus(checks, statusName) {
  if (!Array.isArray(checks)) return 0;
  return checks.filter((check) => check && check.status === statusName).length;
}

function evaluateThresholds(result, opts) {
  const failureCount = countByStatus(result?.checks, 'fail');
  const warningCount = countByStatus(result?.checks, 'warn');
  const violations = [];
  if (opts.maxFailureCount !== null && failureCount > opts.maxFailureCount) {
    violations.push(`failure count ${failureCount} exceeds --max-failure-count=${opts.maxFailureCount}`);
  }
  if (opts.maxWarningCount !== null && warningCount > opts.maxWarningCount) {
    violations.push(`warning count ${warningCount} exceeds --max-warning-count=${opts.maxWarningCount}`);
  }
  return { failureCount, warningCount, violations };
}

function statusIcon(status) {
  if (status === 'pass') return '✓';
  if (status === 'warn') return '!';
  return '✗';
}

function printHumanSummary(result, logger = console) {
  logger.log(`Append-only DB enablement validation: ${result.status.toUpperCase()}`);
  logger.log('');
  for (const check of result.checks) {
    logger.log(`  ${statusIcon(check.status)} [${check.status.padEnd(4)}] ${check.name} — ${check.message}`);
  }
  logger.log('');
  logger.log('Recommended sequence:');
  for (const line of result.recommendedCommands) {
    logger.log(`  ${line}`);
  }
  if (result.status === 'fail') {
    logger.log('');
    logger.log('Validation FAILED. Do NOT enable DB_WRITE_AI_USAGE_ENABLED or DB_WRITE_ERROR_LOG_ENABLED.');
  } else if (result.status === 'warn') {
    logger.log('');
    logger.log('Validation passed with warnings. Review them before enabling write flags.');
  }
}

function printHelp(logger = console) {
  logger.log('Usage: node scripts/validate-append-only-db-enablement.mjs [--json] [--write-report=<path>] [--help]');
  logger.log('');
  logger.log('Performs read-only checks for AI-usage + Error-Center append-only Postgres enablement:');
  logger.log('  - DATABASE_URL configured');
  logger.log('  - DB health (passive)');
  logger.log('  - migration files present + applied');
  logger.log('  - feature flag state');
  logger.log('  - backfill/reconcile tooling present');
  logger.log('  - documentation present');
  logger.log('');
  logger.log('Options:');
  logger.log('  --json                       Emit machine-readable JSON on stdout.');
  logger.log('  --write-report=<path>        Write a sanitized JSON pre-flight report to <path>.');
  logger.log('                               Creates parent directories as needed. Opt-in only.');
  logger.log('                               Report contains no DATABASE_URL, credentials, or raw logs.');
  logger.log('  --max-failure-count=<n>      Exit 1 when the number of fail checks exceeds <n>.');
  logger.log('                               Default behavior is unchanged (fail status alone exits 1).');
  logger.log('  --max-warning-count=<n>      Exit 1 when the number of warn checks exceeds <n>.');
  logger.log('                               Useful on protected branches that should not tolerate any warnings.');
  logger.log('  --help, -h                   Show this help and exit.');
  logger.log('');
  logger.log('No flags are mutated. No migrations are applied. No backfill is run. No writes are performed.');
}

export async function main(argv = process.argv.slice(2), logger = console) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    logger.error(err?.message || String(err));
    process.exitCode = 1;
    return { ok: false, status: 'invalid_threshold', error: err?.message || String(err) };
  }
  if (opts.help) {
    printHelp(logger);
    return { status: 'pass', checks: [], recommendedCommands: [] };
  }

  const result = await validateAppendOnlyDbEnablement();

  let reportPath = null;
  let reportError = null;
  if (opts.writeReport) {
    try {
      const written = writeAppendOnlyDbEnablementReport(result, opts.writeReport);
      reportPath = written.reportPath;
    } catch (err) {
      reportError = err;
    }
  }

  const thresholds = evaluateThresholds(result, opts);

  if (opts.json) {
    const stdoutPayload = reportPath ? { ...result, reportPath } : { ...result };
    if (opts.maxFailureCount !== null || opts.maxWarningCount !== null) {
      stdoutPayload.thresholds = {
        maxFailureCount: opts.maxFailureCount,
        maxWarningCount: opts.maxWarningCount,
        failureCount: thresholds.failureCount,
        warningCount: thresholds.warningCount,
        violations: thresholds.violations,
      };
    }
    logger.log(JSON.stringify(stdoutPayload, null, 2));
  } else {
    printHumanSummary(result, logger);
    if (reportPath) {
      logger.log('');
      logger.log(`Report written to ${reportPath}`);
    }
    if (thresholds.violations.length > 0) {
      logger.log('');
      for (const violation of thresholds.violations) {
        logger.log(`Threshold violation: ${violation}`);
      }
    }
  }

  if (reportError) {
    logger.error(reportError.message);
    process.exitCode = 1;
    return { ...result, reportPath: null, reportError: reportError.message };
  }

  if (result.status === 'fail' || thresholds.violations.length > 0) {
    process.exitCode = 1;
  }
  return reportPath ? { ...result, reportPath, thresholds } : { ...result, thresholds };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  });
}
