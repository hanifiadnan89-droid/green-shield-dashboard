// Local/staging fallback for the CI append-only validation gate.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/run-append-only-validation-ci.mjs
//   DATABASE_URL=postgres://... node scripts/run-append-only-validation-ci.mjs --migrate
//   node scripts/run-append-only-validation-ci.mjs --report=./reports/append-only-validation-staging.json
//   node scripts/run-append-only-validation-ci.mjs --help
//
// Strict non-goals (identical to the GitHub Actions workflow):
//   - never enables DB_WRITE_AI_USAGE_ENABLED / DB_WRITE_ERROR_LOG_ENABLED
//   - never enables DB_READ_AI_USAGE_ENABLED / DB_READ_ERROR_LOG_ENABLED
//   - never runs `--apply` backfill
//   - never touches production data unless the operator explicitly aimed
//     DATABASE_URL at production AND passed --migrate (in which case they
//     are choosing to run the standard migration set)
//
// Migrations are only applied when --migrate is passed. Otherwise the script
// runs as a pure read-only validator that reports migration status and
// validation outcome.

import { fileURLToPath } from 'url';
import path from 'path';
import { runMigrationStatus, runPendingMigrations } from '../services/db/migrations.js';
import {
  validateAppendOnlyDbEnablement,
  writeAppendOnlyDbEnablementReport,
} from '../repositories/backfill/appendOnlyDbEnablementValidation.js';

function parseArgs(argv) {
  const opts = {
    migrate: false,
    help: false,
    reportPath: './reports/append-only-validation-ci.json',
    explicitReport: false,
  };
  for (const arg of argv) {
    if (arg === '--migrate') opts.migrate = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--report=')) {
      opts.reportPath = arg.slice('--report='.length);
      opts.explicitReport = true;
    }
  }
  return opts;
}

function printHelp(logger = console) {
  logger.log('Usage: node scripts/run-append-only-validation-ci.mjs [--migrate] [--report=<path>] [--help]');
  logger.log('');
  logger.log('Runs the Stage 34/35 append-only validator against the Postgres pointed to by DATABASE_URL,');
  logger.log('writes a sanitized JSON report, and exits 1 on validation failure.');
  logger.log('');
  logger.log('Options:');
  logger.log('  --migrate         Apply pending migrations to the target database before validating.');
  logger.log('                    Without this flag, migrations are only inspected, never applied.');
  logger.log('  --report=<path>   Write the sanitized JSON report to <path>.');
  logger.log('                    Defaults to ./reports/append-only-validation-ci.json');
  logger.log('  --help, -h        Show this help and exit.');
  logger.log('');
  logger.log('Required environment:');
  logger.log('  DATABASE_URL      Postgres connection string for the disposable/staging database.');
  logger.log('                    Never point this at production from this script unless you have');
  logger.log('                    independently confirmed you also want --migrate to run against it.');
  logger.log('');
  logger.log('Feature flags must be OFF for the run to be considered safe. The validator itself will');
  logger.log('flag any DB_WRITE_*/DB_READ_* that is already enabled.');
  logger.log('');
  logger.log('Related artifacts:');
  logger.log('  - GitHub Actions workflow:  .github/workflows/append-only-db-validation.yml');
  logger.log('  - CI workflow artifact:     append-only-validation-report (download from a workflow run)');
  logger.log('  - Sanitized staging report: ./reports/append-only-validation-staging.json (recommended path)');
  logger.log('  - Example clean baseline:   docs/examples/append-only-validation-baseline.example.json');
  logger.log('  - Runbook:                  docs/append-only-db-enablement-runbook.md');
}

function ensureDatabaseConfigured(logger) {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    logger.error('DATABASE_URL is not configured. Set DATABASE_URL to a disposable/staging Postgres before running this script.');
    return false;
  }
  return true;
}

export async function main(argv = process.argv.slice(2), logger = console) {
  const opts = parseArgs(argv);
  if (opts.help) {
    printHelp(logger);
    return { ok: true, status: 'help' };
  }

  if (!ensureDatabaseConfigured(logger)) {
    process.exitCode = 1;
    return { ok: false, status: 'no_database_url' };
  }

  // 1. Migration status before any optional apply.
  try {
    const statusBefore = await runMigrationStatus();
    logger.log('Migration status (before):');
    for (const item of statusBefore) {
      logger.log(`  ${String(item.status).padEnd(8)} ${item.name}`);
    }
  } catch (err) {
    logger.error(`Migration status failed: ${err?.message || err}`);
    process.exitCode = 1;
    return { ok: false, status: 'migration_status_failed', error: err?.message || String(err) };
  }

  // 2. Apply migrations only when explicitly requested.
  if (opts.migrate) {
    try {
      const applied = await runPendingMigrations();
      if (applied.applied.length === 0) {
        logger.log('No pending migrations to apply.');
      } else {
        logger.log(`Applied migrations: ${applied.applied.join(', ')}`);
      }
    } catch (err) {
      logger.error(`Migration apply failed: ${err?.message || err}`);
      process.exitCode = 1;
      return { ok: false, status: 'migration_apply_failed', error: err?.message || String(err) };
    }
  } else {
    logger.log('Skipping migration apply (pass --migrate to apply pending migrations to the target database).');
  }

  // 3. Run the validator and write a sanitized report.
  const result = await validateAppendOnlyDbEnablement();
  const resolvedReportPath = path.resolve(opts.reportPath);
  let reportError = null;
  try {
    writeAppendOnlyDbEnablementReport(result, resolvedReportPath);
    logger.log(`Validation report written to ${resolvedReportPath}`);
  } catch (err) {
    reportError = err;
    logger.error(err?.message || err);
  }

  logger.log(`Validation status: ${result.status.toUpperCase()}`);
  for (const check of result.checks) {
    logger.log(`  [${check.status.padEnd(4)}] ${check.name} — ${check.message}`);
  }

  if (reportError) {
    process.exitCode = 1;
    return { ok: false, status: 'report_write_failed', validationStatus: result.status };
  }

  if (result.status === 'fail') {
    process.exitCode = 1;
    return { ok: false, status: 'validation_failed', validationStatus: 'fail', reportPath: resolvedReportPath };
  }

  return { ok: true, status: 'validation_complete', validationStatus: result.status, reportPath: resolvedReportPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  });
}
