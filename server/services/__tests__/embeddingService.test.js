import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createEmbeddings: vi.fn(),
}));

vi.mock('../ai/embeddings/embeddingProvider.js', () => ({
  createEmbeddings: mocks.createEmbeddings,
}));

import {
  cosineSimilarity,
  generateEmbedding,
  generateEmbeddingsBatch,
} from '../embeddingService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('embeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createEmbeddings.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1, 0.2] },
      ],
    });
  });

  it('delegates single embeddings to embeddingProvider while preserving model and output shape', async () => {
    const vector = await generateEmbedding(` ${'a'.repeat(8010)} `, {
      endpoint: 'knowledge-base-search',
      module: 'knowledgeBase',
    });

    expect(vector).toEqual([0.1, 0.2]);
    expect(mocks.createEmbeddings).toHaveBeenCalledTimes(1);
    const [payload] = mocks.createEmbeddings.mock.calls[0];
    expect(payload.model).toBe('text-embedding-3-small');
    expect(payload.input).toHaveLength(8000);
    expect(payload.input).not.toContain(' ');
    expect(payload.signal).toBeInstanceOf(AbortSignal);
  });

  it('delegates batch embeddings and preserves provider index ordering', async () => {
    mocks.createEmbeddings.mockResolvedValueOnce({
      data: [
        { index: 1, embedding: [0.3, 0.4] },
        { index: 0, embedding: [0.1, 0.2] },
      ],
    });

    const vectors = await generateEmbeddingsBatch([' first ', ' second '], {
      endpoint: 'knowledge-base-ingest',
      module: 'knowledgeBase',
    });

    expect(vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    expect(mocks.createEmbeddings).toHaveBeenCalledTimes(1);
    const [payload] = mocks.createEmbeddings.mock.calls[0];
    expect(payload.model).toBe('text-embedding-3-small');
    expect(payload.inputs).toEqual(['first', 'second']);
    expect(payload.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves provider error behavior', async () => {
    mocks.createEmbeddings.mockRejectedValueOnce(new Error('OPENAI_API_KEY is not set. Add it to server/.env to enable semantic retrieval.'));

    await expect(generateEmbedding('search text')).rejects.toThrow('OPENAI_API_KEY is not set. Add it to server/.env to enable semantic retrieval.');
  });

  it('preserves cosine similarity behavior', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('does not import OpenAI directly from embeddingService.js', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'embeddingService.js'), 'utf8');
    expect(source).not.toContain("from 'openai'");
    expect(source).not.toContain('from "openai"');
    expect(source).not.toContain('@anthropic-ai/sdk');
    expect(source).toContain("from './ai/embeddings/embeddingProvider.js'");
  });
});
