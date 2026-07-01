import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../..');
const docPath = path.join(repoDir, 'docs/error-center-runtime-dual-write.md');

describe('Error Center runtime dual-write documentation', () => {
  it('documents default-off flags, current-store source of truth, and recursion protection', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = fs.readFileSync(docPath, 'utf8').toLowerCase();

    for (const phrase of [
      'error center logs only',
      'db_write_error_log_enabled=false',
      'db_read_error_log_enabled=false',
      'current json/file error center logs remain the source of truth',
      'postgres repositories are not constructed',
      'db_dual_write_error_log_failed',
      'must not create another error center event',
      'backfill and reconciliation',
    ]) {
      expect(doc).toContain(phrase);
    }
  });
});
