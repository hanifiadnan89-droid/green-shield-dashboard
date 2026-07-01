import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../..');
const docPath = path.join(repoDir, 'docs/append-only-backfill-reconciliation.md');

describe('append-only backfill documentation', () => {
  it('documents dry-run, apply, reconciliation, source of truth, and DB flags', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = fs.readFileSync(docPath, 'utf8').toLowerCase();

    for (const phrase of [
      'dry-run',
      '--apply',
      'reconciliation',
      'current json/file stores remain the source of truth',
      'db_write_ai_usage_enabled',
      'db_write_error_log_enabled',
      'npm run db:backfill:append-only',
      'npm run db:reconcile:append-only',
    ]) {
      expect(doc).toContain(phrase);
    }
  });
});

