import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  embeddingsCreate: vi.fn(),
  recordAIUsage: vi.fn(),
}));

vi.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    constructor(options) {
      this.options = options;
      this.embeddings = {
        create: mocks.embeddingsCreate,
      };
    }
  },
}));

vi.mock('../../AIUsageRecorder.js', () => ({
  recordAIUsage: mocks.recordAIUsage,
}));

import { createEmbeddings, resetEmbeddingProviderForTests } from '../embeddingProvider.js';

const ORIGINAL_ENV = { ...process.env };

describe('embeddingProvider', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, OPENAI_API_KEY: 'test-openai-key' };
    mocks.embeddingsCreate.mockReset();
    mocks.recordAIUsage.mockReset();
    resetEmbeddingProviderForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    resetEmbeddingProviderForTests();
  });

  it('calls OpenAI embeddings with the provided model and batch input shape', async () => {
    const signal = AbortSignal.timeout(1000);
    mocks.embeddingsCreate.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1, 0.2] },
        { index: 1, embedding: [0.3, 0.4] },
      ],
    });

    const result = await createEmbeddings({
      model: 'text-embedding-3-small',
      inputs: ['first text', 'second text'],
      signal,
    });

    expect(result.data).toHaveLength(2);
    expect(mocks.embeddingsCreate).toHaveBeenCalledTimes(1);
    expect(mocks.embeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['first text', 'second text'],
    }, { signal });
  });

  it('preserves optional dimensions only when provided', async () => {
    mocks.embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [0.1] }] });

    await createEmbeddings({
      model: 'text-embedding-3-small',
      input: 'single text',
      dimensions: 1536,
    });

    expect(mocks.embeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'single text',
      dimensions: 1536,
    }, { signal: undefined });
  });

  it('preserves missing API key behavior', async () => {
    delete process.env.OPENAI_API_KEY;
    resetEmbeddingProviderForTests();

    await expect(createEmbeddings({
      model: 'text-embedding-3-small',
      input: 'text',
    })).rejects.toThrow('OPENAI_API_KEY is not set. Add it to server/.env to enable semantic retrieval.');
    expect(mocks.embeddingsCreate).not.toHaveBeenCalled();
  });

  it('does not log raw embedded text', async () => {
    mocks.embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [0.1] }] });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await createEmbeddings({
      model: 'text-embedding-3-small',
      input: 'sensitive customer text',
    });

    const logs = [
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ].flat().join(' ');
    expect(logs).not.toContain('sensitive customer text');
  });

  it('records sanitized usage on successful single-input embeddings call', async () => {
    mocks.embeddingsCreate.mockResolvedValue({
      data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
    });

    await createEmbeddings({
      model: 'text-embedding-3-small',
      input: 'hello world',
    });

    expect(mocks.recordAIUsage).toHaveBeenCalledTimes(1);
    const entry = mocks.recordAIUsage.mock.calls[0][0];
    expect(entry).toMatchObject({
      endpoint: 'openai.embeddings.create',
      feature: 'embeddings',
      provider: 'openai',
      model: 'text-embedding-3-small',
      inputSize: 'hello world'.length,
      outputSize: 1,
      success: true,
      metadata: { inputCount: 1 },
    });
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records vector count (not vector contents) for batch embeddings', async () => {
    mocks.embeddingsCreate.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1, 0.2] },
        { index: 1, embedding: [0.3, 0.4] },
        { index: 2, embedding: [0.5, 0.6] },
      ],
    });

    await createEmbeddings({
      model: 'text-embedding-3-small',
      inputs: ['alpha', 'beta', 'gamma'],
    });

    const entry = mocks.recordAIUsage.mock.calls[0][0];
    expect(entry.outputSize).toBe(3);
    expect(entry.inputSize).toBe('alpha'.length + 'beta'.length + 'gamma'.length);
    expect(entry.metadata).toEqual({ inputCount: 3 });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('alpha');
    expect(serialized).not.toContain('beta');
    expect(serialized).not.toContain('gamma');
    expect(serialized).not.toContain('0.1');
    expect(serialized).not.toContain('0.6');
  });

  it('does not pass embedded text, input arrays, or vector contents into recordAIUsage', async () => {
    mocks.embeddingsCreate.mockResolvedValue({
      data: [{ index: 0, embedding: [0.42, 0.99] }],
    });

    await createEmbeddings({
      model: 'text-embedding-3-small',
      input: 'SECRET CUSTOMER PII 207-555-0100',
    });

    const entry = mocks.recordAIUsage.mock.calls[0][0];
    expect(entry).not.toHaveProperty('input');
    expect(entry).not.toHaveProperty('inputs');
    expect(entry).not.toHaveProperty('text');
    expect(entry).not.toHaveProperty('data');
    expect(entry).not.toHaveProperty('embedding');
    expect(entry).not.toHaveProperty('embeddings');
    expect(entry).not.toHaveProperty('raw');
    expect(entry).not.toHaveProperty('response');
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('SECRET CUSTOMER PII');
    expect(serialized).not.toContain('207-555-0100');
    expect(serialized).not.toContain('0.42');
    expect(serialized).not.toContain('0.99');
  });

  it('records sanitized failure metadata when the provider call rejects, and rethrows the original error', async () => {
    const providerError = Object.assign(new Error('rate limited'), { status: 429, code: 'rate_limit' });
    mocks.embeddingsCreate.mockRejectedValueOnce(providerError);

    await expect(createEmbeddings({
      model: 'text-embedding-3-small',
      inputs: ['one', 'two'],
    })).rejects.toBe(providerError);

    expect(mocks.recordAIUsage).toHaveBeenCalledTimes(1);
    expect(mocks.recordAIUsage.mock.calls[0][0]).toMatchObject({
      endpoint: 'openai.embeddings.create',
      feature: 'embeddings',
      provider: 'openai',
      model: 'text-embedding-3-small',
      success: false,
      outputSize: 0,
      errorCode: 'rate_limit',
      metadata: { inputCount: 2 },
    });
  });

  it('does not break a successful embedding response when usage persistence fails', async () => {
    mocks.embeddingsCreate.mockResolvedValue({
      data: [{ index: 0, embedding: [0.1] }],
    });
    mocks.recordAIUsage.mockImplementationOnce(() => { throw new Error('disk full'); });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await createEmbeddings({
      model: 'text-embedding-3-small',
      input: 'hello',
    });

    expect(result.data).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[embeddings] usage persistence failed:',
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  it('still rethrows a provider failure even when usage persistence is also failing', async () => {
    const providerError = Object.assign(new Error('boom'), { status: 500, code: 'server_error' });
    mocks.embeddingsCreate.mockRejectedValueOnce(providerError);
    mocks.recordAIUsage.mockImplementationOnce(() => { throw new Error('disk full'); });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(createEmbeddings({
      model: 'text-embedding-3-small',
      input: 'hi',
    })).rejects.toBe(providerError);
    warnSpy.mockRestore();
  });
});
