import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transcriptionCreate: vi.fn(),
  recordAIUsage: vi.fn(),
}));

vi.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    constructor() {
      this.audio = {
        transcriptions: {
          create: mocks.transcriptionCreate,
        },
      };
    }
  },
}));

vi.mock('../../AIUsageRecorder.js', () => ({
  recordAIUsage: mocks.recordAIUsage,
}));

import { resetTranscriptionProviderForTests, transcribeAudioFile } from '../transcriptionProvider.js';

describe('transcriptionProvider', () => {
  let tempDir;

  beforeEach(() => {
    resetTranscriptionProviderForTests();
    mocks.transcriptionCreate.mockReset();
    mocks.recordAIUsage.mockReset();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-transcription-provider-'));
  });

  afterEach(() => {
    resetTranscriptionProviderForTests();
    vi.restoreAllMocks();
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('delegates audio transcription to OpenAI with the existing Whisper request shape', async () => {
    mocks.transcriptionCreate.mockResolvedValue({
      text: 'Training transcript',
      segments: [{ id: 1 }],
      language: 'en',
      duration: 2,
    });
    const filePath = path.join(tempDir, 'training.mp3');
    fs.writeFileSync(filePath, Buffer.from('audio'));

    const result = await transcribeAudioFile(filePath);

    expect(result.text).toBe('Training transcript');
    expect(mocks.transcriptionCreate).toHaveBeenCalledTimes(1);
    const [payload] = mocks.transcriptionCreate.mock.calls[0];
    expect(payload.file.path).toBe(filePath);
    expect(payload.model).toBe('whisper-1');
    expect(payload.response_format).toBe('verbose_json');
    expect(payload.timestamp_granularities).toEqual(['segment']);
  });

  it('records sanitized usage on successful transcription with the documented metadata shape', async () => {
    const filePath = path.join(tempDir, 'reading.mp3');
    const audioBuffer = Buffer.alloc(2048, 0x42);
    fs.writeFileSync(filePath, audioBuffer);
    const transcriptText = 'A transcript that should not be persisted';
    mocks.transcriptionCreate.mockResolvedValue({
      text: transcriptText,
      segments: [{ id: 1 }, { id: 2 }],
      language: 'en',
      duration: 11.5,
    });

    await transcribeAudioFile(filePath);

    expect(mocks.recordAIUsage).toHaveBeenCalledTimes(1);
    const entry = mocks.recordAIUsage.mock.calls[0][0];
    expect(entry).toMatchObject({
      endpoint: 'openai.audio.transcriptions.create',
      feature: 'transcription',
      provider: 'openai',
      model: 'whisper-1',
      inputSize: audioBuffer.length,
      outputSize: transcriptText.length,
      success: true,
      metadata: { fileSizeBytes: audioBuffer.length, extension: 'mp3' },
    });
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('does not pass transcript text, raw response, or file path into recordAIUsage', async () => {
    const filePath = path.join(tempDir, '/Users/private/folder/SECRET.mp3'.replace(/^\/.+\//, ''));
    const realPath = path.join(tempDir, 'do-not-leak.mp3');
    fs.writeFileSync(realPath, Buffer.from('secret audio bytes'));
    const transcriptText = 'TRANSCRIPT BODY 207-555-0100';
    mocks.transcriptionCreate.mockResolvedValue({
      text: transcriptText,
      segments: [{ id: 1, text: 'segment leak' }],
      language: 'en',
      duration: 3,
    });

    await transcribeAudioFile(realPath);

    const entry = mocks.recordAIUsage.mock.calls[0][0];
    expect(entry).not.toHaveProperty('text');
    expect(entry).not.toHaveProperty('segments');
    expect(entry).not.toHaveProperty('raw');
    expect(entry).not.toHaveProperty('response');
    expect(entry).not.toHaveProperty('file');
    expect(entry).not.toHaveProperty('filePath');
    expect(entry).not.toHaveProperty('path');
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain(transcriptText);
    expect(serialized).not.toContain('207-555-0100');
    expect(serialized).not.toContain('segment leak');
    expect(serialized).not.toContain(realPath);
    expect(serialized).not.toContain(tempDir);
    expect(serialized).not.toContain('secret audio bytes');
    // Should NOT include the leading dot in extension, and certainly no path components.
    expect(entry.metadata.extension).toBe('mp3');
    // Suppress unused-var lint for the irrelevant constructed path string above.
    expect(typeof filePath).toBe('string');
  });

  it('records sanitized failure metadata when the provider call rejects, and rethrows the original error', async () => {
    const filePath = path.join(tempDir, 'broken.wav');
    fs.writeFileSync(filePath, Buffer.from('audio'));
    const providerError = Object.assign(new Error('rate limited'), { status: 429, code: 'rate_limit' });
    mocks.transcriptionCreate.mockRejectedValueOnce(providerError);

    await expect(transcribeAudioFile(filePath)).rejects.toBe(providerError);

    expect(mocks.recordAIUsage).toHaveBeenCalledTimes(1);
    expect(mocks.recordAIUsage.mock.calls[0][0]).toMatchObject({
      endpoint: 'openai.audio.transcriptions.create',
      feature: 'transcription',
      provider: 'openai',
      model: 'whisper-1',
      success: false,
      outputSize: 0,
      errorCode: 'rate_limit',
      metadata: { extension: 'wav' },
    });
  });

  it('does not break a successful transcription response when usage persistence fails', async () => {
    const filePath = path.join(tempDir, 'safe.mp3');
    fs.writeFileSync(filePath, Buffer.from('audio bytes'));
    mocks.transcriptionCreate.mockResolvedValue({
      text: 'Safe transcript',
      segments: [],
      language: 'en',
      duration: 1,
    });
    mocks.recordAIUsage.mockImplementationOnce(() => { throw new Error('disk full'); });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await transcribeAudioFile(filePath);

    expect(result.text).toBe('Safe transcript');
    expect(warnSpy).toHaveBeenCalledWith(
      '[transcription] usage persistence failed:',
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  it('still rethrows a provider failure when usage persistence is also failing', async () => {
    const filePath = path.join(tempDir, 'doomed.mp3');
    fs.writeFileSync(filePath, Buffer.from('audio'));
    const providerError = Object.assign(new Error('boom'), { status: 500 });
    mocks.transcriptionCreate.mockRejectedValueOnce(providerError);
    mocks.recordAIUsage.mockImplementationOnce(() => { throw new Error('disk full'); });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(transcribeAudioFile(filePath)).rejects.toBe(providerError);
    warnSpy.mockRestore();
  });
});
