import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../../..');
const docPath = path.join(repoDir, 'docs/ai-usage-runtime-dual-write.md');

describe('AI usage runtime dual-write documentation', () => {
  it('documents AI-only scope, default-off flags, current-store source of truth, and Error Center deferral', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = fs.readFileSync(docPath, 'utf8').toLowerCase();

    for (const phrase of [
      'ai usage logs only',
      'error center runtime wiring is intentionally deferred',
      'db_write_ai_usage_enabled=false',
      'db_read_ai_usage_enabled=false',
      'current json/file ai usage logs remain the source of truth',
      'postgres write failure',
      'backfill and reconciliation',
    ]) {
      expect(doc).toContain(phrase);
    }
  });
});
