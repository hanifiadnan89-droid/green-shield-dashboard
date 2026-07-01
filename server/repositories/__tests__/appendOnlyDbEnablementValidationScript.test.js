import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(SERVER_DIR, 'scripts', 'validate-append-only-db-enablement.mjs');

const ORIGINAL_EXIT_CODE = process.exitCode;

function captureLogger() {
  const lines = [];
  return {
    log: (...args) => lines.push(args.join(' ')),
    error: (...args) => lines.push(args.join(' ')),
    warn: (...args) => lines.push(args.join(' ')),
    info: (...args) => lines.push(args.join(' ')),
    lines,
  };
}

describe('validate-append-only-db-enablement.mjs CLI', () => {
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(() => {
    process.exitCode = ORIGINAL_EXIT_CODE;
    vi.restoreAllMocks();
  });

  it('exists on disk', () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('can be imported without executing main and without any DB or flag mutations', async () => {
    const beforeEnv = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
    });
    const module = await import('../../scripts/validate-append-only-db-enablement.mjs');
    expect(typeof module.main).toBe('function');
    const afterEnv = JSON.stringify({
      DB_WRITE_AI_USAGE_ENABLED: process.env.DB_WRITE_AI_USAGE_ENABLED,
      DB_READ_AI_USAGE_ENABLED: process.env.DB_READ_AI_USAGE_ENABLED,
      DB_WRITE_ERROR_LOG_ENABLED: process.env.DB_WRITE_ERROR_LOG_ENABLED,
      DB_READ_ERROR_LOG_ENABLED: process.env.DB_READ_ERROR_LOG_ENABLED,
    });
    expect(afterEnv).toBe(beforeEnv);
  });

  it('main() with --help prints usage without invoking validation', async () => {
    const logger = captureLogger();
    const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
    await main(['--help'], logger);
    const output = logger.lines.join('\n');
    expect(output).toMatch(/Usage:/);
    expect(output).toMatch(/--json/);
    expect(output).toMatch(/no writes are performed/i);
  });

  it('main() with --json prints structured JSON without secrets even when DATABASE_URL is unset', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      const result = await main(['--json'], logger);
      const output = logger.lines.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('fail');
      expect(Array.isArray(parsed.checks)).toBe(true);
      expect(parsed.checks.find((c) => c.name === 'database_configured').status).toBe('fail');
      expect(Array.isArray(parsed.recommendedCommands)).toBe(true);
      expect(output).not.toMatch(/sk-[A-Za-z0-9]/);
      expect(output).not.toContain('Bearer');
      expect(result.status).toBe('fail');
      expect(process.exitCode).toBe(1);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    }
  });

  it('main() without --json prints a readable summary that mentions the safe sequence', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      await main([], logger);
      const output = logger.lines.join('\n');
      expect(output).toMatch(/Append-only DB enablement validation/);
      expect(output).toMatch(/Recommended sequence/);
      expect(output).toMatch(/db:migrate/);
      expect(output).toMatch(/db:backfill:append-only/);
      expect(output).toMatch(/db:reconcile:append-only/);
      expect(output).toMatch(/--strict/);
      expect(output).toMatch(/DB_WRITE_AI_USAGE_ENABLED=true/);
      expect(output).toMatch(/Validation FAILED|Validation passed with warnings|FAIL|WARN|PASS/);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    }
  });

  it('package.json wires the db:validate:append-only npm script to the CLI', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SERVER_DIR, 'package.json'), 'utf-8'));
    expect(pkg.scripts['db:validate:append-only']).toBe('node scripts/validate-append-only-db-enablement.mjs');
  });

  it('--help mentions the --write-report option and its sanitization promise', async () => {
    const logger = captureLogger();
    const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
    await main(['--help'], logger);
    const output = logger.lines.join('\n');
    expect(output).toMatch(/--write-report=<path>/);
    expect(output).toMatch(/sanitized JSON pre-flight report/i);
    expect(output).toMatch(/Opt-in only/i);
    expect(output).toMatch(/no DATABASE_URL, credentials, or raw logs/i);
  });

  it('--write-report alone writes a sanitized JSON file and prints the path', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-aoreport-cli-'));
    const reportPath = path.join(tmpDir, 'append-only-validation.json');
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      const result = await main([`--write-report=${reportPath}`], logger);
      const output = logger.lines.join('\n');
      expect(output).toMatch(/Append-only DB enablement validation/);
      expect(output).toContain(`Report written to ${path.resolve(reportPath)}`);
      expect(fs.existsSync(reportPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      expect(parsed.reportType).toBe('append_only_db_enablement_validation');
      expect(parsed.status).toBe('fail');
      expect(parsed.safeSummary.databaseConfigured).toBe(false);
      expect(JSON.stringify(parsed)).not.toMatch(/sk-[A-Za-z0-9]/);
      expect(result.reportPath).toBe(path.resolve(reportPath));
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('--json --write-report keeps stdout as a single parseable JSON object with reportPath', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-aoreport-cli-json-'));
    const reportPath = path.join(tmpDir, 'report.json');
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      await main(['--json', `--write-report=${reportPath}`], logger);
      const output = logger.lines.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed.reportPath).toBe(path.resolve(reportPath));
      expect(parsed.status).toBe('fail');
      expect(Array.isArray(parsed.checks)).toBe(true);
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(output).not.toMatch(/sk-[A-Za-z0-9]/);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('--write-report creates parent directories when they do not exist', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-aoreport-mkdirp-'));
    const reportPath = path.join(tmpDir, 'a', 'b', 'c', 'report.json');
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      await main([`--write-report=${reportPath}`], logger);
      expect(fs.existsSync(reportPath)).toBe(true);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exits with code 1 when --write-report cannot write the report', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-aoreport-fail-'));
    const blockedPath = path.join(tmpDir, 'blocked');
    fs.mkdirSync(blockedPath, { recursive: true }); // a directory in the way of the file
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      const result = await main([`--write-report=${blockedPath}`], logger);
      expect(process.exitCode).toBe(1);
      expect(result.reportError).toBeDefined();
      const output = logger.lines.join('\n');
      expect(output).toMatch(/Failed to write validation report/);
    } finally {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('--json without --write-report preserves the pre-Stage-35 stdout shape (no reportPath key)', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      await main(['--json'], logger);
      const parsed = JSON.parse(logger.lines.join('\n'));
      expect(parsed).not.toHaveProperty('reportPath');
      expect(parsed).not.toHaveProperty('thresholds');
      expect(parsed.status).toBe('fail');
      expect(Array.isArray(parsed.checks)).toBe(true);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    }
  });

  // Stage 38: CLI strictness thresholds
  it('--help mentions --max-failure-count and --max-warning-count', async () => {
    const logger = captureLogger();
    const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
    await main(['--help'], logger);
    const output = logger.lines.join('\n');
    expect(output).toMatch(/--max-failure-count=<n>/);
    expect(output).toMatch(/--max-warning-count=<n>/);
    expect(output).toMatch(/default behavior is unchanged/i);
  });

  it('--max-warning-count=0 exits 1 when validation has at least one warn', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      // With no DATABASE_URL, the validator already produces warns (e.g. database_health skipped).
      const result = await main(['--json', '--max-warning-count=0'], logger);
      expect(process.exitCode).toBe(1);
      const parsed = JSON.parse(logger.lines.join('\n'));
      expect(parsed.thresholds.maxWarningCount).toBe(0);
      expect(parsed.thresholds.warningCount).toBeGreaterThan(0);
      expect(parsed.thresholds.violations.length).toBeGreaterThan(0);
      expect(result.thresholds.violations.some((v) => v.includes('--max-warning-count'))).toBe(true);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    }
  });

  it('--max-failure-count=0 exits 1 when validation has at least one fail', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      // With no DATABASE_URL, the database_configured check fails.
      const result = await main(['--json', '--max-failure-count=0'], logger);
      expect(process.exitCode).toBe(1);
      const parsed = JSON.parse(logger.lines.join('\n'));
      expect(parsed.thresholds.failureCount).toBeGreaterThan(0);
      expect(result.thresholds.violations.some((v) => v.includes('--max-failure-count'))).toBe(true);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    }
  });

  it('thresholds high enough to absorb the actual counts do not exit 1 on their own (validation status still rules)', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      // Validation still fails (no DATABASE_URL), so exit code 1 is from result.status, not thresholds.
      await main(['--json', '--max-failure-count=99', '--max-warning-count=99'], logger);
      const parsed = JSON.parse(logger.lines.join('\n'));
      expect(parsed.status).toBe('fail');
      expect(parsed.thresholds.violations).toEqual([]);
      expect(process.exitCode).toBe(1); // still from result.status === 'fail'
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    }
  });

  it('rejects non-integer --max-warning-count safely with a clear error and exit 1', async () => {
    const logger = captureLogger();
    const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
    const result = await main(['--max-warning-count=many'], logger);
    expect(process.exitCode).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('invalid_threshold');
    const output = logger.lines.join('\n');
    expect(output).toMatch(/--max-warning-count must be a non-negative integer/);
  });

  it('rejects negative --max-failure-count safely with a clear error and exit 1', async () => {
    const logger = captureLogger();
    const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
    const result = await main(['--max-failure-count=-3'], logger);
    expect(process.exitCode).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('invalid_threshold');
  });

  it('rejects empty --max-failure-count safely with a clear error and exit 1', async () => {
    const logger = captureLogger();
    const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
    const result = await main(['--max-failure-count='], logger);
    expect(process.exitCode).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('invalid_threshold');
  });

  it('--json with thresholds remains a single parseable JSON object', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      await main(['--json', '--max-warning-count=99', '--max-failure-count=99'], logger);
      const parsed = JSON.parse(logger.lines.join('\n'));
      expect(parsed.thresholds.maxWarningCount).toBe(99);
      expect(parsed.thresholds.maxFailureCount).toBe(99);
      expect(Array.isArray(parsed.thresholds.violations)).toBe(true);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    }
  });

  it('--write-report continues to write a file even when thresholds violate', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-stage38-threshold-'));
    const reportPath = path.join(tmpDir, 'report.json');
    try {
      const logger = captureLogger();
      const { main } = await import('../../scripts/validate-append-only-db-enablement.mjs');
      await main([`--write-report=${reportPath}`, '--max-warning-count=0'], logger);
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(process.exitCode).toBe(1);
    } finally {
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
