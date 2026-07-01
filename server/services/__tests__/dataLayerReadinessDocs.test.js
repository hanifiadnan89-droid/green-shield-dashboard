import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, '../../..');
const docPath = path.join(repoDir, 'docs/data-layer-production-readiness.md');

describe('data layer production readiness documentation', () => {
  it('documents current storage and future database migration concepts', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = fs.readFileSync(docPath, 'utf8');
    const normalizedDoc = doc.toLowerCase();

    for (const phrase of [
      'Google Sheets',
      'AIUsageLogService',
      'errorLogService',
      'lead ownership',
      'organizationIntegrations',
      'organizationUsers',
      'conversationMessages',
      'knowledgeStorage',
      'Postgres',
      'dual-write',
      'backup',
      'restore',
      'row_number',
    ]) {
      expect(normalizedDoc).toContain(phrase.toLowerCase());
    }
  });
});
