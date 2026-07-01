import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../..');
const docPath = path.join(repoDir, 'docs/append-only-dual-write-plan.md');

describe('append-only dual-write documentation', () => {
  it('documents disabled flags, current-store source of truth, and deferred leads', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = fs.readFileSync(docPath, 'utf8').toLowerCase();

    for (const phrase of [
      'ai usage logs',
      'error center logs',
      'db_write_ai_usage_enabled',
      'db_write_error_log_enabled',
      'default to false',
      'current-store',
      'source of truth',
      'postgres adapters',
      'leads are deferred',
    ]) {
      expect(doc).toContain(phrase);
    }
  });
});

