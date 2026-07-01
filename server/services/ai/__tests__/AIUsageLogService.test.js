import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  recordAIUsage,
  listAIUsage,
  summarizeAIUsage,
  getAIUsageLogStorageStatus,
  getSafeAIUsageLogStorageStatus,
  resetAIUsageLogServiceForTests,
  buildAIUsageEntry,
} from '../AIUsageLogService.js';

const ORIGINAL_ENV = { ...process.env };

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gs-ai-usage-'));
}

function suppressLogs() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('AIUsageLogService', () => {
  let dir;

  beforeEach(() => {
    dir = tempDir();
    process.env = {
      ...ORIGINAL_ENV,
      AI_USAGE_LOG_DATA_DIR: dir,
      AI_USAGE_LOG_STORAGE_BACKEND: 'persistent_disk',
      NODE_ENV: 'test',
    };
    resetAIUsageLogServiceForTests();
    suppressLogs();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    resetAIUsageLogServiceForTests();
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('records a successful usage entry with the documented shape', () => {
    const entry = recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 812,
      inputSize: 1234,
      outputSize: 456,
      success: true,
    });

    expect(entry).toMatchObject({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 812,
      inputSize: 1234,
      outputSize: 456,
      success: true,
      errorCode: null,
      status: 'success',
    });
    expect(entry.id).toMatch(/^ai_usage_/);
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  });

  it('records a failed usage entry and tags status=failure', () => {
    const entry = recordAIUsage({
      endpoint: '/api/ai/sales-coach',
      feature: 'sales-coach',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      durationMs: 300,
      inputSize: 80,
      outputSize: 0,
      success: false,
      errorCode: 'AI_PROVIDER_RATE_LIMIT',
    });

    expect(entry).toMatchObject({
      success: false,
      errorCode: 'AI_PROVIDER_RATE_LIMIT',
      status: 'failure',
    });
  });

  it('generates unique ids per recorded entry', () => {
    const ids = new Set();
    for (let i = 0; i < 5; i += 1) {
      const entry = recordAIUsage({
        endpoint: '/api/ai/assist-reply',
        feature: 'assist-reply',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        durationMs: 100,
        inputSize: 10,
        outputSize: 5,
        success: true,
      });
      ids.add(entry.id);
    }
    expect(ids.size).toBe(5);
  });

  it('lists entries with the most recent first and respects the limit', () => {
    for (let i = 0; i < 4; i += 1) {
      recordAIUsage({
        endpoint: '/api/ai/assist-reply',
        feature: 'assist-reply',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        durationMs: 100 + i,
        inputSize: 10,
        outputSize: 5,
        success: true,
      });
    }

    const limited = listAIUsage({ limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited[0].durationMs).toBe(103);
    expect(limited[1].durationMs).toBe(102);
  });

  it('filters by feature, provider, model, endpoint, and success', () => {
    recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 100,
      inputSize: 10,
      outputSize: 5,
      success: true,
    });
    recordAIUsage({
      endpoint: '/api/ai/sales-coach',
      feature: 'sales-coach',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      durationMs: 200,
      inputSize: 20,
      outputSize: 0,
      success: false,
      errorCode: 'AI_PROVIDER_RATE_LIMIT',
    });

    expect(listAIUsage({ feature: 'sales-coach' })).toHaveLength(1);
    expect(listAIUsage({ provider: 'anthropic' })).toHaveLength(2);
    expect(listAIUsage({ model: 'claude-sonnet-4-6' })).toHaveLength(1);
    expect(listAIUsage({ endpoint: '/api/ai/assist-reply' })).toHaveLength(1);
    expect(listAIUsage({ success: true })).toHaveLength(1);
    expect(listAIUsage({ success: false })).toHaveLength(1);
    expect(listAIUsage({ success: 'true' })).toHaveLength(1);
  });

  it('filters by from/to timestamps', () => {
    const entry = recordAIUsage({
      timestamp: '2026-06-29T12:00:00.000Z',
      endpoint: '/api/ai/sales-coach',
      feature: 'sales-coach',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      durationMs: 100,
      inputSize: 10,
      outputSize: 5,
      success: true,
    });

    expect(listAIUsage({ from: '2026-06-30T00:00:00.000Z' })).toHaveLength(0);
    expect(listAIUsage({ to: '2026-06-01T00:00:00.000Z' })).toHaveLength(0);
    expect(listAIUsage({ from: '2026-06-29T00:00:00.000Z', to: '2026-06-29T23:59:59.000Z' }))
      .toEqual([expect.objectContaining({ id: entry.id })]);
  });

  it('summarizes totals, status splits, and grouping', () => {
    recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 100,
      inputSize: 10,
      outputSize: 5,
      success: true,
    });
    recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 300,
      inputSize: 10,
      outputSize: 5,
      success: false,
      errorCode: 'AI_PROVIDER_RATE_LIMIT',
    });
    recordAIUsage({
      endpoint: '/api/ai/sales-coach',
      feature: 'sales-coach',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      durationMs: 800,
      inputSize: 50,
      outputSize: 20,
      success: true,
    });

    const summary = summarizeAIUsage();
    expect(summary.total).toBe(3);
    expect(summary.success).toBe(2);
    expect(summary.failure).toBe(1);
    expect(summary.averageDurationMs).toBe(400);
    expect(summary.byFeature['assist-reply']).toBe(2);
    expect(summary.byFeature['sales-coach']).toBe(1);
    expect(summary.byProvider.anthropic).toBe(3);
    expect(summary.byErrorCode.AI_PROVIDER_RATE_LIMIT).toBe(1);
  });

  it('does not persist prompt body, message content, or raw response fields', () => {
    recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 100,
      inputSize: 10,
      outputSize: 5,
      success: true,
      prompt: 'SECRET PROMPT BODY 207-555-0100',
      messages: [{ role: 'user', content: 'CUSTOMER MESSAGE' }],
      raw: { content: [{ text: 'RAW MODEL OUTPUT' }] },
      text: 'RAW MODEL OUTPUT',
      json: { draft: 'do not store' },
      system: 'SYSTEM PROMPT',
      metadata: {
        Authorization: 'Bearer secret-token',
        nested: { apiKey: 'sk-abc123', safe: 'visible' },
      },
    });

    const filePath = getAIUsageLogStorageStatus().filePath;
    const raw = fs.readFileSync(filePath, 'utf-8');

    expect(raw).not.toContain('SECRET PROMPT BODY');
    expect(raw).not.toContain('CUSTOMER MESSAGE');
    expect(raw).not.toContain('RAW MODEL OUTPUT');
    expect(raw).not.toContain('SYSTEM PROMPT');
    expect(raw).not.toContain('do not store');
    expect(raw).not.toContain('207-555-0100');
    expect(raw).not.toContain('sk-abc123');
    expect(raw).not.toContain('secret-token');

    const [stored] = listAIUsage({});
    expect(stored.prompt).toBeUndefined();
    expect(stored.messages).toBeUndefined();
    expect(stored.raw).toBeUndefined();
    expect(stored.text).toBeUndefined();
    expect(stored.json).toBeUndefined();
    expect(stored.system).toBeUndefined();
    expect(stored.metadata).toBeUndefined();
  });

  it('persists only explicit safe usage metadata keys', () => {
    recordAIUsage({
      endpoint: '/api/ai/draft-reply',
      feature: 'draft-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 100,
      inputSize: 10,
      outputSize: 5,
      success: true,
      metadata: {
        deprecatedRoute: true,
        deprecatedPath: '/api/ai/draft-reply',
        replacementPath: '/api/ai/assist-reply',
        prompt: 'SECRET PROMPT',
        messages: ['CUSTOMER MESSAGE'],
        rawResponse: 'RAW MODEL OUTPUT',
        apiKey: 'sk-abc123',
        customerPhone: '207-555-0100',
        arbitrary: 'do not persist',
      },
    });

    const [stored] = listAIUsage({});
    expect(stored.metadata).toEqual({
      deprecatedRoute: true,
      deprecatedPath: '/api/ai/draft-reply',
      replacementPath: '/api/ai/assist-reply',
    });
    const raw = fs.readFileSync(getAIUsageLogStorageStatus().filePath, 'utf-8');
    expect(raw).not.toContain('SECRET PROMPT');
    expect(raw).not.toContain('CUSTOMER MESSAGE');
    expect(raw).not.toContain('RAW MODEL OUTPUT');
    expect(raw).not.toContain('sk-abc123');
    expect(raw).not.toContain('207-555-0100');
    expect(raw).not.toContain('do not persist');
  });

  it('handles missing storage file by treating the log as empty', () => {
    const filePath = getAIUsageLogStorageStatus().filePath;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    expect(listAIUsage({})).toEqual([]);
    expect(summarizeAIUsage()).toMatchObject({ total: 0, success: 0, failure: 0, averageDurationMs: 0 });
  });

  it('handles corrupted storage file by treating it as empty without throwing', () => {
    const filePath = getAIUsageLogStorageStatus().filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{not valid json', 'utf-8');

    expect(() => listAIUsage({})).not.toThrow();
    expect(listAIUsage({})).toEqual([]);
  });

  it('aggregates embeddings and transcription entries into byFeature and byProvider summaries', () => {
    recordAIUsage({
      endpoint: 'openai.embeddings.create',
      feature: 'embeddings',
      provider: 'openai',
      model: 'text-embedding-3-small',
      durationMs: 50,
      inputSize: 200,
      outputSize: 3,
      success: true,
    });
    recordAIUsage({
      endpoint: 'openai.audio.transcriptions.create',
      feature: 'transcription',
      provider: 'openai',
      model: 'whisper-1',
      durationMs: 1500,
      inputSize: 4096,
      outputSize: 412,
      success: true,
    });
    recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 700,
      inputSize: 100,
      outputSize: 80,
      success: true,
    });

    const summary = summarizeAIUsage();
    expect(summary.total).toBe(3);
    expect(summary.byFeature).toEqual({
      embeddings: 1,
      transcription: 1,
      'assist-reply': 1,
    });
    expect(summary.byProvider).toEqual({ openai: 2, anthropic: 1 });

    expect(listAIUsage({ feature: 'embeddings' })).toHaveLength(1);
    expect(listAIUsage({ feature: 'transcription' })).toHaveLength(1);
    expect(listAIUsage({ provider: 'openai' })).toHaveLength(2);
  });

  it('getSafeAIUsageLogStorageStatus returns only the documented safe fields', () => {
    const safe = getSafeAIUsageLogStorageStatus();
    expect(Object.keys(safe).sort()).toEqual([
      'backend', 'configured', 'inRepo', 'production', 'render', 'source', 'warning', 'writeSafe',
    ]);
    expect(safe).not.toHaveProperty('filePath');
    expect(safe).not.toHaveProperty('dataDir');
    expect(safe).not.toHaveProperty('renderConfigValid');
    expect(safe.backend).toBe('persistent_disk');
    expect(safe.writeSafe).toBe(true);
  });

  it('returns null and skips writes when production Render storage is unsafe', () => {
    process.env = {
      ...ORIGINAL_ENV,
      RENDER: 'true',
      NODE_ENV: 'production',
      AI_USAGE_LOG_DATA_DIR: '',
      KNOWLEDGE_DATA_DIR: '',
      KNOWLEDGE_STORAGE_BACKEND: '',
    };
    resetAIUsageLogServiceForTests();

    const result = recordAIUsage({
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      durationMs: 100,
      inputSize: 10,
      outputSize: 5,
      success: true,
    });

    expect(result).toBeNull();
  });

  // Stage 41 shadow-write support — buildAIUsageEntry is used by
  // AIUsageRecorder to construct a Postgres-shaped entry when the current
  // store refuses the write (writeSafe=false on Render). Confirms the export
  // exists and returns a shape with id/timestamp/success/status aligned to
  // the ai_usage_logs schema.
  it('buildAIUsageEntry is exported and returns a shaped entry with id + success/status', () => {
    const entry = buildAIUsageEntry({
      endpoint: '/api/ai/sales-coach/module',
      feature: 'objectionCoach',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      durationMs: 16985,
      inputSize: 10844,
      outputSize: 2849,
      success: true,
    });
    expect(entry).toMatchObject({
      endpoint: '/api/ai/sales-coach/module',
      feature: 'objectionCoach',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      durationMs: 16985,
      inputSize: 10844,
      outputSize: 2849,
      success: true,
      status: 'success',
      errorCode: null,
    });
    expect(entry.id).toMatch(/^ai_usage_[0-9a-f]{16}$/);
    expect(typeof entry.timestamp).toBe('string');
  });
});
