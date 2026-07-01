import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  RECOMMENDED_COMMANDS,
  REPORT_GENERATED_BY,
  REPORT_SCHEMA_VERSION,
  REPORT_TYPE,
} from '../backfill/appendOnlyDbEnablementValidation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(__dirname, '../../..');
const EXAMPLE_PATH = path.join(REPO_DIR, 'docs', 'examples', 'append-only-validation-baseline.example.json');

function loadExample() {
  const raw = fs.readFileSync(EXAMPLE_PATH, 'utf-8');
  return { raw, parsed: JSON.parse(raw) };
}

describe('docs/examples/append-only-validation-baseline.example.json', () => {
  it('exists at the documented path', () => {
    expect(fs.existsSync(EXAMPLE_PATH)).toBe(true);
  });

  it('is valid JSON', () => {
    expect(() => loadExample()).not.toThrow();
  });

  it('uses the Stage 35 report type, schema version, and generatedBy constants', () => {
    const { parsed } = loadExample();
    expect(parsed.reportType).toBe(REPORT_TYPE);
    expect(parsed.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(parsed.generatedBy).toBe(REPORT_GENERATED_BY);
  });

  it('represents a clean pass result', () => {
    const { parsed } = loadExample();
    expect(parsed.status).toBe('pass');
    expect(parsed.warningCount).toBe(0);
    expect(parsed.failureCount).toBe(0);
    for (const check of parsed.checks) {
      expect(check.status).toBe('pass');
    }
  });

  it('safeSummary asserts write and read flags are OFF and infrastructure is present', () => {
    const { parsed } = loadExample();
    expect(parsed.safeSummary).toEqual({
      databaseConfigured: true,
      writeFlagsEnabled: false,
      readFlagsEnabled: false,
      migrationChecksIncluded: true,
      backfillToolingPresent: true,
      documentationPresent: true,
    });
  });

  it('feature_flags check has all four DB flags OFF', () => {
    const { parsed } = loadExample();
    const flagsCheck = parsed.checks.find((c) => c.name === 'feature_flags');
    expect(flagsCheck.details.flags).toEqual({
      dbWriteAIUsageEnabled: false,
      dbReadAIUsageEnabled: false,
      dbWriteErrorLogEnabled: false,
      dbReadErrorLogEnabled: false,
    });
  });

  it('recommendedCommands matches the canonical Stage 34 sequence', () => {
    const { parsed } = loadExample();
    expect(parsed.recommendedCommands).toEqual([...RECOMMENDED_COMMANDS]);
  });

  it('every check declares one of pass | warn | fail', () => {
    const { parsed } = loadExample();
    expect(Array.isArray(parsed.checks)).toBe(true);
    expect(parsed.checks.length).toBeGreaterThan(0);
    for (const check of parsed.checks) {
      expect(['pass', 'warn', 'fail']).toContain(check.status);
      expect(typeof check.name).toBe('string');
      expect(check.name.length).toBeGreaterThan(0);
    }
  });

  it('uses an obviously non-resolvable example hostname only (RFC 6761 .example.invalid)', () => {
    const { raw } = loadExample();
    // The placeholder host must use the reserved .example.invalid TLD.
    expect(raw).toContain('db.example.invalid');
    // No real-looking production hostnames.
    expect(raw).not.toMatch(/\b[A-Za-z0-9-]+\.render\.com\b/);
    expect(raw).not.toMatch(/\b[A-Za-z0-9-]+\.amazonaws\.com\b/);
    expect(raw).not.toMatch(/\b[A-Za-z0-9-]+\.googleusercontent\.com\b/);
    expect(raw).not.toMatch(/\bgreenshieldpest\.com\b/i);
  });

  it('does not embed raw DATABASE_URL credentials', () => {
    const { raw, parsed } = loadExample();
    // Pre-redacted is fine; raw credentials are not.
    expect(raw).toMatch(/postgres:\/\/\*{3}:\*{3}@/);
    expect(raw).not.toMatch(/postgres:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
    // The report itself must not carry a databaseUrl field (Stage 35 strips it).
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toMatch(/"databaseUrl"\s*:/i);
  });

  it('does not contain secret/token/password/api-key/bearer/cookie value patterns', () => {
    const { raw } = loadExample();
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]+/);
    expect(raw).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{8,}/);
    expect(raw).not.toMatch(/"api[_-]?key"\s*:\s*"[^"*]{4,}"/i);
    expect(raw).not.toMatch(/"authorization"\s*:\s*"[^"*]{4,}"/i);
    expect(raw).not.toMatch(/"password"\s*:\s*"[^"*]{4,}"/i);
    expect(raw).not.toMatch(/"token"\s*:\s*"[^"*]{4,}"/i);
    expect(raw).not.toMatch(/"secret"\s*:\s*"[^"*]{4,}"/i);
    expect(raw).not.toMatch(/"cookie"\s*:\s*"[^"*]{4,}"/i);
  });

  it('does not contain raw AI prompts, customer messages, or Error Center records', () => {
    const { parsed, raw } = loadExample();
    // None of the Stage 33/35 forbidden-content fields should appear as keys.
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toMatch(/"prompt"\s*:/i);
    expect(serialized).not.toMatch(/"messages"\s*:/i);
    expect(serialized).not.toMatch(/"transcript"\s*:/i);
    expect(serialized).not.toMatch(/"embedding"\s*:/i);
    expect(serialized).not.toMatch(/"embeddings"\s*:/i);
    expect(serialized).not.toMatch(/"errorLog"\s*:/i);
    expect(serialized).not.toMatch(/"errors"\s*:/i);
    // Common phone/PII shapes used in fake customer fixtures should not appear.
    expect(raw).not.toMatch(/\b\d{3}-\d{3}-\d{4}\b/);
  });

  it('carries a top-level explanatory comment marking the file as an example', () => {
    const { parsed } = loadExample();
    expect(typeof parsed._comment).toBe('string');
    expect(parsed._comment.toUpperCase()).toContain('EXAMPLE');
    expect(parsed._comment).toMatch(/placeholder/i);
  });
});
