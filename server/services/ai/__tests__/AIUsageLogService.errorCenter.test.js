import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createError: vi.fn(),
}));

vi.mock('../../errorLogRecorder.js', () => ({
  createError: mocks.createError,
}));

import { recordAIUsage, resetAIUsageLogServiceForTests } from '../AIUsageLogService.js';

const ORIGINAL_ENV = { ...process.env };

function suppressLogs() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

function setUnsafeRenderProductionEnv() {
  process.env = {
    ...ORIGINAL_ENV,
    RENDER: 'true',
    NODE_ENV: 'production',
    AI_USAGE_LOG_DATA_DIR: '',
    AI_USAGE_LOG_STORAGE_BACKEND: '',
    KNOWLEDGE_DATA_DIR: '',
    KNOWLEDGE_STORAGE_BACKEND: '',
  };
}

describe('AIUsageLogService — Error Center integration on unsafe storage', () => {
  beforeEach(() => {
    mocks.createError.mockReset();
    resetAIUsageLogServiceForTests();
    suppressLogs();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    resetAIUsageLogServiceForTests();
  });

  it('records exactly one Error Center entry across multiple unsafe recordAIUsage calls', () => {
    setUnsafeRenderProductionEnv();

    const sampleEntry = () => ({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 100,
      inputSize: 10,
      outputSize: 5,
      success: true,
    });

    for (let i = 0; i < 5; i += 1) {
      const result = recordAIUsage(sampleEntry());
      expect(result).toBeNull();
    }

    expect(mocks.createError).toHaveBeenCalledTimes(1);
    const [arg] = mocks.createError.mock.calls[0];
    expect(arg).toMatchObject({
      source: 'ai',
      module: 'ai-usage-log',
      severity: 'high',
      errorCode: 'AI_USAGE_LOG_STORAGE_UNSAFE',
    });
    expect(arg.message).toContain('production writes are disabled');
  });

  it('omits filePath and dataDir from the Error Center metadata', () => {
    setUnsafeRenderProductionEnv();

    recordAIUsage({
      endpoint: '/api/ai/sales-coach',
      feature: 'sales-coach',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      durationMs: 10,
      inputSize: 1,
      outputSize: 0,
      success: false,
      errorCode: 'AI_PROVIDER_RATE_LIMIT',
    });

    expect(mocks.createError).toHaveBeenCalledTimes(1);
    const [arg] = mocks.createError.mock.calls[0];
    expect(arg.rawMetadata).toBeDefined();
    expect(arg.rawMetadata).not.toHaveProperty('filePath');
    expect(arg.rawMetadata).not.toHaveProperty('dataDir');
    expect(arg.rawMetadata).not.toHaveProperty('renderConfigValid');
    expect(arg.rawMetadata).toMatchObject({
      backend: expect.any(String),
      configured: expect.any(Boolean),
      source: expect.any(String),
      render: true,
      production: true,
      writeSafe: false,
    });
    // rawMetadata itself must never embed an absolute path or the persistence file name.
    const rawMetaSerialized = JSON.stringify(arg.rawMetadata);
    expect(rawMetaSerialized).not.toMatch(/\/var\/data/);
    expect(rawMetaSerialized).not.toMatch(/ai-usage-log\.json/);
    expect(rawMetaSerialized).not.toMatch(/^\/|:\\/);
    // The top-level argument must not leak path/dataDir keys either.
    expect(arg).not.toHaveProperty('filePath');
    expect(arg).not.toHaveProperty('dataDir');
  });

  it('does not call the Error Center when storage is write-safe', () => {
    process.env = {
      ...ORIGINAL_ENV,
      AI_USAGE_LOG_DATA_DIR: '/tmp/gs-safe-' + Date.now(),
      AI_USAGE_LOG_STORAGE_BACKEND: 'persistent_disk',
      NODE_ENV: 'test',
    };

    const out = recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 50,
      inputSize: 10,
      outputSize: 5,
      success: true,
    });

    expect(out).not.toBeNull();
    expect(mocks.createError).not.toHaveBeenCalled();
  });

  it('does not throw when the Error Center call itself throws', () => {
    setUnsafeRenderProductionEnv();
    mocks.createError.mockImplementationOnce(() => { throw new Error('disk full'); });

    expect(() => recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 10,
      inputSize: 1,
      outputSize: 1,
      success: true,
    })).not.toThrow();
  });

  it('does not throw on the unsafe path even without any mocked error handler', () => {
    setUnsafeRenderProductionEnv();
    expect(() => recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 1,
      inputSize: 1,
      outputSize: 1,
      success: true,
    })).not.toThrow();
  });

  it('records again after resetAIUsageLogServiceForTests is called (once per process semantics)', () => {
    setUnsafeRenderProductionEnv();

    recordAIUsage({
      feature: 'assist-reply', provider: 'anthropic', model: 'm', durationMs: 1,
      inputSize: 1, outputSize: 0, success: true,
    });
    expect(mocks.createError).toHaveBeenCalledTimes(1);

    recordAIUsage({
      feature: 'assist-reply', provider: 'anthropic', model: 'm', durationMs: 1,
      inputSize: 1, outputSize: 0, success: true,
    });
    expect(mocks.createError).toHaveBeenCalledTimes(1);

    resetAIUsageLogServiceForTests();

    recordAIUsage({
      feature: 'assist-reply', provider: 'anthropic', model: 'm', durationMs: 1,
      inputSize: 1, outputSize: 0, success: true,
    });
    expect(mocks.createError).toHaveBeenCalledTimes(2);
  });
});
