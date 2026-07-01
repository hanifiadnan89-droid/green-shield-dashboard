import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeAIRequest: vi.fn(),
}));

vi.mock('../../ai/execution/AIExecutionEngine.js', () => ({
  executeAIRequest: mocks.executeAIRequest,
}));

import { autoTagAndSummarize } from '../ingestionPipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('knowledgeBase ingestionPipeline autoTagAndSummarize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeAIRequest.mockResolvedValue({
      text: JSON.stringify({
        title: 'Better Sales Guide',
        summary: 'This content teaches sales reps how to frame value and handle customer concerns.',
        tags: ['Pricing', 'Value Framing', 'Not A Real Tag'],
        keyInsights: [
          'Lead with value.',
          'Tie the explanation to the customer concern.',
          'Avoid unsupported discounts.',
          'Use proof.',
          'Close directly.',
          'Extra insight should be trimmed.',
        ],
      }),
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('uses AIExecutionEngine with the existing model, token limit, and prompt shape', async () => {
    const result = await autoTagAndSummarize('upload.txt', 'Pricing and value framing content.'.repeat(20));

    expect(result).toEqual({
      title: 'Better Sales Guide',
      summary: 'This content teaches sales reps how to frame value and handle customer concerns.',
      autoTags: ['Pricing', 'Value Framing'],
      keyInsights: [
        'Lead with value.',
        'Tie the explanation to the customer concern.',
        'Avoid unsupported discounts.',
        'Use proof.',
        'Close directly.',
      ],
    });

    expect(mocks.executeAIRequest).toHaveBeenCalledTimes(1);
    const [payload] = mocks.executeAIRequest.mock.calls[0];
    expect(payload.provider).toBe('anthropic');
    expect(payload.model).toBe('claude-haiku-4-5-20251001');
    expect(payload.maxTokens).toBe(512);
    expect(payload.endpoint).toBe('knowledge-base-ingestion');
    expect(payload.feature).toBe('knowledge-base-ingestion');
    expect(payload.metadata).toEqual({ source: 'ingestionPipeline' });
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0].content).toContain('You are a knowledge classifier for Green Shield Pest Solutions');
    expect(payload.messages[0].content).toContain('Return only valid JSON. No markdown, no extra text.');
  });

  it('preserves JSON fence parsing behavior', async () => {
    mocks.executeAIRequest.mockResolvedValueOnce({
      text: '```json\n{"title":"Guide","summary":"Summary","tags":["Closing"],"keyInsights":["Ask a closing question"]}\n```',
    });

    const result = await autoTagAndSummarize('guide.md', 'closing content');

    expect(result).toEqual({
      title: 'Guide',
      summary: 'Summary',
      autoTags: ['Closing'],
      keyInsights: ['Ask a closing question'],
    });
  });

  it('preserves fallback behavior on malformed model output', async () => {
    mocks.executeAIRequest.mockResolvedValueOnce({
      text: 'not valid json',
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await autoTagAndSummarize('Original Title', 'Sensitive full document text that should not be logged.');

    expect(result).toEqual({
      title: 'Original Title',
      summary: '',
      autoTags: [],
      keyInsights: [],
    });
    expect(warnSpy).toHaveBeenCalledWith('[ingestion] Auto-tag failed:', expect.any(String));
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('Sensitive full document text');
    warnSpy.mockRestore();
  });

  it('handles provider failure safely and does not log document text', async () => {
    mocks.executeAIRequest.mockRejectedValueOnce(new Error('provider unavailable'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await autoTagAndSummarize('Upload Title', 'Do not log this document body.');

    expect(result).toEqual({
      title: 'Upload Title',
      summary: '',
      autoTags: [],
      keyInsights: [],
    });
    expect(warnSpy).toHaveBeenCalledWith('[ingestion] Auto-tag failed:', 'provider unavailable');
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('Do not log this document body');
    warnSpy.mockRestore();
  });

  it('limits prompt document preview to the first 6000 characters', async () => {
    const text = `${'a'.repeat(6000)}SHOULD_NOT_BE_INCLUDED`;

    await autoTagAndSummarize('Large Upload', text);

    const [payload] = mocks.executeAIRequest.mock.calls[0];
    expect(payload.messages[0].content).toContain('a'.repeat(100));
    expect(payload.messages[0].content).not.toContain('SHOULD_NOT_BE_INCLUDED');
  });

  it('does not import Anthropic or OpenAI directly from ingestionPipeline.js', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'ingestionPipeline.js'), 'utf8');
    expect(source).not.toContain('@anthropic-ai/sdk');
    expect(source).not.toContain("from 'openai'");
    expect(source).not.toContain('from "openai"');
    expect(source).not.toContain('messages.create');
    expect(source).toContain("from '../ai/execution/AIExecutionEngine.js'");
  });
});
