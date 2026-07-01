import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '../../..');

const ALLOWED_DIRECT_PROVIDER_IMPORTS = new Set([
  'services/ai/execution/AIExecutionEngine.js',
  'services/ai/embeddings/embeddingProvider.js',
  'services/ai/extraction/transcriptionProvider.js',
]);

function walkJsFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'coverage') continue;
    if (entry.name === '__tests__') continue;
    if (entry.name.endsWith('.test.js')) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativeServerPath(filePath) {
  return path.relative(serverDir, filePath).replaceAll(path.sep, '/');
}

describe('AI provider access boundaries', () => {
  it('keeps direct provider imports out of migrated AI route and engine surfaces', () => {
    const filesWithProviderImports = walkJsFiles(serverDir)
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        return source.includes("from '@anthropic-ai/sdk'")
          || source.includes('from "@anthropic-ai/sdk"')
          || source.includes("from 'openai'")
          || source.includes('from "openai"');
      })
      .map(relativeServerPath)
      .sort();

    expect(filesWithProviderImports).toEqual([...ALLOWED_DIRECT_PROVIDER_IMPORTS].sort());
  });

  it('documents active direct-provider deferrals outside the migrated /api/ai generation surface', () => {
    expect([...ALLOWED_DIRECT_PROVIDER_IMPORTS].sort()).toEqual([
      'services/ai/embeddings/embeddingProvider.js',
      'services/ai/execution/AIExecutionEngine.js',
      'services/ai/extraction/transcriptionProvider.js',
    ]);
  });

  it('keeps /api/ai routes and Sales Coach engine off direct provider SDKs', () => {
    for (const relativePath of ['routes/ai.js', 'services/salesCoachEngine.js']) {
      const source = fs.readFileSync(path.join(serverDir, relativePath), 'utf8');
      expect(source).not.toContain('@anthropic-ai/sdk');
      expect(source).not.toContain("from 'openai'");
      expect(source).not.toContain('from "openai"');
      expect(source).not.toContain('messages.create');
    }
  });
});
