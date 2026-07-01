import { describe, expect, it, vi } from 'vitest';
import { parseAppendOnlyLogArgs, printJsonSummary } from '../backfill/appendOnlyLogCli.js';

describe('append-only log CLI helpers', () => {
  it('defaults to dry-run all-domain mode', () => {
    expect(parseAppendOnlyLogArgs([])).toEqual({
      domain: 'all',
      apply: false,
      dryRun: true,
      strict: false,
      limit: null,
    });
  });

  it('parses domain, apply, limit, and strict flags', () => {
    expect(parseAppendOnlyLogArgs(['--domain=ai_usage', '--apply', '--limit=25', '--strict']))
      .toEqual({
        domain: 'ai_usage',
        apply: true,
        dryRun: false,
        strict: true,
        limit: 25,
      });
  });

  it('rejects invalid domains', () => {
    expect(() => parseAppendOnlyLogArgs(['--domain=leads']))
      .toThrow('Invalid domain: leads');
  });

  it('prints summary JSON without raw log content assumptions', () => {
    const logger = { log: vi.fn() };
    printJsonSummary({ ok: true }, logger);
    expect(logger.log).toHaveBeenCalledWith('{\n  "ok": true\n}');
  });
});

