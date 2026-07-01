import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
  recordAIUsage: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: mocks.messagesCreate,
    },
  })),
}));

vi.mock('../../AIUsageRecorder.js', () => ({
  recordAIUsage: mocks.recordAIUsage,
}));

import {
  executeAIRequest,
  resetAIExecutionEngineForTests,
} from '../AIExecutionEngine.js';

const ORIGINAL_ENV = { ...process.env };

describe('AIExecutionEngine', () => {
  let usageDir;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAIExecutionEngineForTests();
    usageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-ai-exec-usage-'));
    process.env = {
      ...ORIGINAL_ENV,
      ANTHROPIC_API_KEY: 'test-key',
      AI_USAGE_LOG_DATA_DIR: usageDir,
      AI_USAGE_LOG_STORAGE_BACKEND: 'persistent_disk',
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    if (usageDir && fs.existsSync(usageDir)) fs.rmSync(usageDir, { recursive: true, force: true });
  });

  it('executes a successful Anthropic request and returns normalized metadata', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello from model' }],
      usage: { input_tokens: 12, output_tokens: 4 },
    });

    const result = await executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      system: 'System prompt',
      messages: [{ role: 'user', content: 'User prompt' }],
      maxTokens: 77,
      temperature: 0.2,
      endpoint: '/api/ai/test',
      feature: 'test-feature',
      req: { ip: '127.0.0.1', headers: {} },
    });

    expect(mocks.messagesCreate).toHaveBeenCalledWith({
      model: 'claude-test',
      max_tokens: 77,
      system: 'System prompt',
      messages: [{ role: 'user', content: 'User prompt' }],
      temperature: 0.2,
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result).toMatchObject({
      text: 'Hello from model',
      json: null,
      usage: { input_tokens: 12, output_tokens: 4 },
      provider: 'anthropic',
      model: 'claude-test',
      endpoint: '/api/ai/test',
      feature: 'test-feature',
    });
    expect(result.durationMs).toEqual(expect.any(Number));
  });

  it('parses JSON when requested', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: {},
    });

    const result = await executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      system: '',
      messages: 'Return JSON',
      maxTokens: 20,
      parseJson: true,
      endpoint: '/api/ai/test',
      feature: 'json-test',
    });

    expect(result.json).toEqual({ ok: true });
    expect(result.text).toBe('{"ok":true}');
  });

  it('returns a controlled error for empty responses', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [],
      usage: {},
    });

    await expect(executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      messages: [{ role: 'user', content: 'Prompt' }],
      maxTokens: 20,
      endpoint: '/api/ai/test',
      feature: 'empty-test',
    })).rejects.toMatchObject({
      code: 'AI_EMPTY_RESPONSE',
      status: 502,
    });
  });

  it('returns a controlled error for malformed JSON', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json' }],
      usage: {},
    });

    await expect(executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      messages: [{ role: 'user', content: 'Prompt' }],
      maxTokens: 20,
      parseJson: true,
      endpoint: '/api/ai/test',
      feature: 'json-test',
    })).rejects.toMatchObject({
      code: 'AI_INVALID_JSON',
      status: 502,
    });
  });

  it('returns a controlled error when the provider API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    resetAIExecutionEngineForTests();

    await expect(executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      messages: [{ role: 'user', content: 'Prompt' }],
      maxTokens: 20,
      endpoint: '/api/ai/test',
      feature: 'missing-key-test',
    })).rejects.toMatchObject({
      code: 'AI_PROVIDER_NOT_CONFIGURED',
      status: 500,
    });
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
  });

  it('maps provider rate-limit errors to controlled unavailable errors', async () => {
    mocks.messagesCreate.mockRejectedValueOnce(Object.assign(new Error('provider says too many requests'), {
      status: 429,
    }));

    await expect(executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      messages: [{ role: 'user', content: 'Prompt' }],
      maxTokens: 20,
      endpoint: '/api/ai/test',
      feature: 'rate-limit-test',
    })).rejects.toMatchObject({
      code: 'AI_PROVIDER_RATE_LIMIT',
      status: 503,
    });
  });

  it('logs usage metadata without logging prompt bodies', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const secretPrompt = 'Customer phone 207-555-0100 and private message';
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Safe output' }],
      usage: { input_tokens: 10, output_tokens: 2 },
    });

    await executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      system: 'System prompt',
      messages: [{ role: 'user', content: secretPrompt }],
      maxTokens: 20,
      endpoint: '/api/ai/test',
      feature: 'logging-test',
    });

    const logged = infoSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('[ai-execution]');
    expect(logged).toContain('logging-test');
    expect(logged).not.toContain(secretPrompt);
    expect(logged).not.toContain('207-555-0100');
    infoSpy.mockRestore();
  });

  it('records sanitized usage on successful AI requests', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello from model' }],
      usage: { input_tokens: 12, output_tokens: 4 },
    });

    await executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      system: 'System prompt SECRET',
      messages: [{ role: 'user', content: 'SECRET PROMPT BODY' }],
      maxTokens: 77,
      endpoint: '/api/ai/test',
      feature: 'success-record',
      usageMetadata: {
        deprecatedRoute: true,
        deprecatedPath: '/api/ai/draft-reply',
        replacementPath: '/api/ai/assist-reply',
      },
      req: { ip: '127.0.0.1', headers: { 'x-request-id': 'req-abc' } },
    });

    expect(mocks.recordAIUsage).toHaveBeenCalledTimes(1);
    const entry = mocks.recordAIUsage.mock.calls[0][0];
    expect(entry).toMatchObject({
      endpoint: '/api/ai/test',
      feature: 'success-record',
      provider: 'anthropic',
      model: 'claude-test',
      success: true,
      errorCode: null,
      requestId: 'req-abc',
      metadata: {
        deprecatedRoute: true,
        deprecatedPath: '/api/ai/draft-reply',
        replacementPath: '/api/ai/assist-reply',
      },
    });
    expect(entry.inputSize).toBeGreaterThan(0);
    expect(entry.outputSize).toBeGreaterThan(0);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry).not.toHaveProperty('prompt');
    expect(entry).not.toHaveProperty('messages');
    expect(entry).not.toHaveProperty('raw');
    expect(entry).not.toHaveProperty('text');
    expect(entry).not.toHaveProperty('system');
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('SECRET PROMPT BODY');
    expect(serialized).not.toContain('System prompt SECRET');
    expect(serialized).not.toContain('Hello from model');
  });

  it('records sanitized usage on failed AI requests', async () => {
    mocks.messagesCreate.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 429 }));

    await expect(executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      messages: [{ role: 'user', content: 'Prompt' }],
      maxTokens: 20,
      endpoint: '/api/ai/test',
      feature: 'failure-record',
      usageMetadata: {
        deprecatedRoute: true,
        deprecatedPath: '/api/ai/coach-objection',
        replacementPath: '/api/ai/sales-coach/module',
      },
    })).rejects.toMatchObject({ code: 'AI_PROVIDER_RATE_LIMIT' });

    expect(mocks.recordAIUsage).toHaveBeenCalledTimes(1);
    expect(mocks.recordAIUsage.mock.calls[0][0]).toMatchObject({
      endpoint: '/api/ai/test',
      feature: 'failure-record',
      provider: 'anthropic',
      success: false,
      errorCode: 'AI_PROVIDER_RATE_LIMIT',
      outputSize: 0,
      metadata: {
        deprecatedRoute: true,
        deprecatedPath: '/api/ai/coach-objection',
        replacementPath: '/api/ai/sales-coach/module',
      },
    });
  });

  it('does not let a usage persistence failure break a successful AI response', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Safe output' }],
      usage: {},
    });
    mocks.recordAIUsage.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      messages: [{ role: 'user', content: 'Prompt' }],
      maxTokens: 20,
      endpoint: '/api/ai/test',
      feature: 'persistence-failure',
    });

    expect(result.text).toBe('Safe output');
    expect(warnSpy).toHaveBeenCalledWith(
      '[ai-execution] usage persistence failed:',
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  // Stage 41 wiring regression — proves the Sales Coach shape reaches
  // AIUsageRecorder unchanged. Combined with salesCoachEngine.test.js (which
  // proves runSalesCoachModule → executeAIRequest), this covers the full
  // /api/ai/sales-coach/module → executeAIRequest → recordAIUsage chain.
  it('records sanitized usage for the /api/ai/sales-coach/module + objectionCoach shape', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"recommendedResponse":"Ok","confidence":80}' }],
      usage: { input_tokens: 42, output_tokens: 12 },
    });

    await executeAIRequest({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      system: 'System prompt',
      messages: [{ role: 'user', content: 'Customer says it is too expensive' }],
      maxTokens: 1100,
      endpoint: '/api/ai/sales-coach/module',
      feature: 'objectionCoach',
      parseJson: true,
      req: { ip: '127.0.0.1', headers: {} },
    });

    expect(mocks.recordAIUsage).toHaveBeenCalledTimes(1);
    const entry = mocks.recordAIUsage.mock.calls[0][0];
    expect(entry).toMatchObject({
      endpoint: '/api/ai/sales-coach/module',
      feature: 'objectionCoach',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      success: true,
      errorCode: null,
    });
    expect(entry.inputSize).toBeGreaterThan(0);
    expect(entry.outputSize).toBeGreaterThan(0);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    // No prompt/response bodies should reach the recorder entry.
    expect(entry).not.toHaveProperty('prompt');
    expect(entry).not.toHaveProperty('messages');
    expect(entry).not.toHaveProperty('text');
    expect(entry).not.toHaveProperty('system');
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('Customer says it is too expensive');
    expect(serialized).not.toContain('recommendedResponse');
    expect(serialized).not.toContain('System prompt');
  });

  it('still records sanitized failure metadata when persistence is failing', async () => {
    mocks.messagesCreate.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
    mocks.recordAIUsage.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(executeAIRequest({
      provider: 'anthropic',
      model: 'claude-test',
      messages: [{ role: 'user', content: 'Prompt' }],
      maxTokens: 20,
      endpoint: '/api/ai/test',
      feature: 'persistence-failure-2',
    })).rejects.toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE' });

    expect(mocks.recordAIUsage).toHaveBeenCalledTimes(1);
    expect(mocks.recordAIUsage.mock.calls[0][0]).toMatchObject({
      feature: 'persistence-failure-2',
      success: false,
    });
    warnSpy.mockRestore();
  });
});
