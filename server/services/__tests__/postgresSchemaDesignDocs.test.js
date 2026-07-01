import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../..');
const docPath = path.join(repoDir, 'docs/postgres-schema-design.md');

describe('postgres schema design documentation', () => {
  it('documents the future CRM Postgres schema and migration safeguards', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = fs.readFileSync(docPath, 'utf8').toLowerCase();

    for (const phrase of [
      'organizations',
      'leads',
      'lead_sheet_mappings',
      'conversation_messages',
      'ai_usage_logs',
      'kb_documents',
      'error_log',
      'indexes',
      'dual-write',
      'feature flags',
      'rollback',
      'row_number',
    ]) {
      expect(doc).toContain(phrase.toLowerCase());
    }
  });
});
