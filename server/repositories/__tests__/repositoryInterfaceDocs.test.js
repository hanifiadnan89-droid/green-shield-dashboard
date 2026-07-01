import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../..');
const docPath = path.join(repoDir, 'docs/repository-interface-plan.md');

describe('repository interface documentation', () => {
  it('documents current-store repositories and future Postgres adapter strategy', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = fs.readFileSync(docPath, 'utf8').toLowerCase();

    for (const phrase of [
      'current-store adapters',
      'future postgres adapters',
      'dual-write',
      'row_number',
      'runtime behavior is unchanged',
      'ai usage',
      'error center',
      'users',
      'integration profiles',
      'lead ownership',
    ]) {
      expect(doc).toContain(phrase.toLowerCase());
    }
  });
});

