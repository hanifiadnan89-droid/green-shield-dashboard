import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../..');
const migrationPath = path.join(repoDir, 'server/migrations/002_create_append_only_log_tables.sql');

describe('append-only log migration', () => {
  it('creates AI usage and Error Center log tables with expected indexes', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

    for (const phrase of [
      'create table if not exists ai_usage_logs',
      'create table if not exists error_log',
      'metadata jsonb',
      'raw_metadata jsonb',
      'idx_ai_usage_logs_timestamp_desc',
      'idx_error_log_org_created_at_desc',
      'idx_error_log_dedup_key',
    ]) {
      expect(sql).toContain(phrase);
    }
  });
});

