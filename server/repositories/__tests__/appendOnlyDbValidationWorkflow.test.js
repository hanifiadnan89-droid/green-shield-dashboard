import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const REPO_DIR = path.resolve(SERVER_DIR, '..');
const WORKFLOW_PATH = path.join(REPO_DIR, '.github', 'workflows', 'append-only-db-validation.yml');
const CI_SCRIPT_PATH = path.join(SERVER_DIR, 'scripts', 'run-append-only-validation-ci.mjs');
const GITIGNORE_PATH = path.join(REPO_DIR, '.gitignore');

function readWorkflow() { return fs.readFileSync(WORKFLOW_PATH, 'utf-8'); }

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

describe('GitHub Actions workflow — append-only DB validation', () => {
  it('exists at the documented path', () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('runs on pull_request paths that cover migrations, repos, scripts, and docs', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/on:\s*\n\s+pull_request/);
    for (const pattern of [
      "'server/migrations/**'",
      "'server/services/db/**'",
      "'server/repositories/**'",
      "'server/scripts/*append-only*'",
      "'server/scripts/validate-append-only-db-enablement.mjs'",
      "'docs/*append-only*'",
      "'docs/postgres-migration-tooling.md'",
    ]) {
      expect(yaml).toContain(pattern);
    }
  });

  it('supports manual workflow_dispatch as well', () => {
    expect(readWorkflow()).toMatch(/workflow_dispatch:/);
  });

  it('uses a disposable postgres service container, not a production secret', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/services:[\s\S]+postgres:[\s\S]+image:\s*postgres:16/);
    expect(yaml).toMatch(/POSTGRES_DB:\s*green_shield_ci/);
    expect(yaml).toMatch(/pg_isready/);
    // No production secret references — workflow runs on the disposable service only.
    expect(yaml).not.toMatch(/secrets\.DATABASE_URL/);
    expect(yaml).not.toMatch(/secrets\.PROD/);
  });

  it('pins all four DB feature flags to false at the job env level', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/DB_WRITE_AI_USAGE_ENABLED:\s*'false'/);
    expect(yaml).toMatch(/DB_READ_AI_USAGE_ENABLED:\s*'false'/);
    expect(yaml).toMatch(/DB_WRITE_ERROR_LOG_ENABLED:\s*'false'/);
    expect(yaml).toMatch(/DB_READ_ERROR_LOG_ENABLED:\s*'false'/);
    // None of them must be flipped to 'true' anywhere in the workflow.
    expect(yaml).not.toMatch(/DB_WRITE_AI_USAGE_ENABLED:\s*'true'/);
    expect(yaml).not.toMatch(/DB_WRITE_ERROR_LOG_ENABLED:\s*'true'/);
    expect(yaml).not.toMatch(/DB_READ_AI_USAGE_ENABLED:\s*'true'/);
    expect(yaml).not.toMatch(/DB_READ_ERROR_LOG_ENABLED:\s*'true'/);
  });

  it('runs db:migrate and db:validate:append-only against the CI database', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/npm run db:migrate --prefix server/);
    expect(yaml).toMatch(/npm run db:migrate:status --prefix server/);
    expect(yaml).toMatch(/npm run db:validate:append-only --prefix server -- \\\s*\n\s*--json \\\s*\n\s*--write-report=\.\/reports\/append-only-validation-ci\.json/);
  });

  it('never runs the apply form of backfill or reconcile', () => {
    const yaml = readWorkflow();
    expect(yaml).not.toMatch(/db:backfill:append-only.*--apply/);
    expect(yaml).not.toMatch(/db:reconcile:append-only/);
  });

  it('uploads the sanitized validation report as a workflow artifact', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/uses:\s*actions\/upload-artifact@v4/);
    expect(yaml).toMatch(/name:\s*append-only-validation-report/);
    expect(yaml).toMatch(/path:\s*reports\/append-only-validation-ci\.json/);
  });

  it('runs append-only repository + DB tooling tests on the CI database', () => {
    const yaml = readWorkflow();
    expect(yaml).toMatch(/repositories\/__tests__/);
    expect(yaml).toMatch(/services\/__tests__\/migrations\.test\.js/);
    expect(yaml).toMatch(/services\/__tests__\/dbConfig\.test\.js/);
  });
});

describe('Local CI/staging fallback script', () => {
  beforeEach(() => {
    process.exitCode = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it('exists on disk', () => {
    expect(fs.existsSync(CI_SCRIPT_PATH)).toBe(true);
  });

  it('package.json wires db:validate:append-only:ci to the script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SERVER_DIR, 'package.json'), 'utf-8'));
    expect(pkg.scripts['db:validate:append-only:ci']).toBe('node scripts/run-append-only-validation-ci.mjs');
  });

  it('can be imported without executing main and without enabling any flag', async () => {
    const before = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
    });
    const module = await import('../../scripts/run-append-only-validation-ci.mjs');
    expect(typeof module.main).toBe('function');
    const after = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
    });
    expect(after).toBe(before);
  });

  it('--help prints usage and the no-production guarantees', async () => {
    const { main } = await import('../../scripts/run-append-only-validation-ci.mjs');
    const logger = captureLogger();
    await main(['--help'], logger);
    const output = logger.lines.join('\n');
    expect(output).toMatch(/Usage:/);
    expect(output).toMatch(/--migrate/);
    expect(output).toMatch(/--report=<path>/);
    expect(output).toMatch(/DATABASE_URL/);
    expect(output).toMatch(/Without this flag, migrations are only inspected/);
  });

  it('exits 1 and prints a clear error when DATABASE_URL is unset', async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { main } = await import('../../scripts/run-append-only-validation-ci.mjs');
      const logger = captureLogger();
      const result = await main([], logger);
      expect(result.ok).toBe(false);
      expect(result.status).toBe('no_database_url');
      expect(process.exitCode).toBe(1);
      const output = logger.lines.join('\n');
      expect(output).toMatch(/DATABASE_URL is not configured/);
      expect(output).not.toMatch(/sk-[A-Za-z0-9]/);
      expect(output).not.toContain('Bearer ');
    } finally {
      if (original !== undefined) process.env.DATABASE_URL = original;
    }
  });
});

describe('.gitignore — generated reports', () => {
  it('ignores reports/ and server/reports/', () => {
    const text = fs.readFileSync(GITIGNORE_PATH, 'utf-8');
    expect(text).toMatch(/^reports\/$/m);
    expect(text).toMatch(/^server\/reports\/$/m);
  });
});
