import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../..');
const docPath = path.join(repoDir, 'docs/postgres-migration-tooling.md');

describe('postgres migration tooling documentation', () => {
  it('documents DB env vars, migrations, tracking, and startup safety', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = fs.readFileSync(docPath, 'utf8').toLowerCase();

    for (const phrase of [
      'DATABASE_URL',
      'DATABASE_SSL',
      'migrations',
      'schema_migrations',
      'db:migrate',
      'do not run on server startup',
      'Sheets/JSON',
      'rollback',
    ]) {
      expect(doc).toContain(phrase.toLowerCase());
    }
  });
});

