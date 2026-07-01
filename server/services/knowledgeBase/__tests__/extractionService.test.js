import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Module from 'module';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PNG } from 'pngjs';

const mocks = vi.hoisted(() => ({
  executeAIRequest: vi.fn(),
  transcribeAudioFile: vi.fn(),
}));
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

vi.mock('../../ai/execution/AIExecutionEngine.js', () => ({
  executeAIRequest: mocks.executeAIRequest,
}));

vi.mock('../../ai/extraction/transcriptionProvider.js', () => ({
  transcribeAudioFile: mocks.transcribeAudioFile,
}));

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_MODULE_LOAD = Module._load;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gs-kb-extraction-'));
}

async function writeTextPdf(filePath, text) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, {
    x: 72,
    y: 700,
    font,
    size: 14,
    color: rgb(0, 0, 0),
    maxWidth: 468,
  });
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function writeImageOnlyPdf(filePath) {
  const doc = await PDFDocument.create();
  const png = new PNG({ width: 24, height: 24 });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = 30;
      png.data[idx + 1] = 90;
      png.data[idx + 2] = 60;
      png.data[idx + 3] = 255;
    }
  }
  const embeddedImage = await doc.embedPng(PNG.sync.write(png));
  const page = doc.addPage([300, 200]);
  page.drawImage(embeddedImage, { x: 50, y: 40, width: 200, height: 120 });
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function writeTestAudio(filePath, durationSeconds = 1, bitrate = '128k') {
  const ffmpegStatic = require('ffmpeg-static');
  const ffmpeg = require('fluent-ffmpeg');
  ffmpeg.setFfmpegPath(ffmpegStatic);

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(`sine=frequency=1000:duration=${durationSeconds}`)
      .inputFormat('lavfi')
      .audioCodec('libmp3lame')
      .audioBitrate(bitrate)
      .audioChannels(1)
      .audioFrequency(16000)
      .output(filePath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function writeTestVideo(filePath, durationSeconds = 8) {
  const ffmpegStatic = require('ffmpeg-static');
  const ffmpeg = require('fluent-ffmpeg');
  ffmpeg.setFfmpegPath(ffmpegStatic);

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(`testsrc=size=32x32:rate=1:duration=${durationSeconds}`)
      .inputFormat('lavfi')
      .input(`sine=frequency=800:duration=${durationSeconds}`)
      .inputFormat('lavfi')
      .videoCodec('mpeg4')
      .audioCodec('aac')
      .outputOptions(['-shortest'])
      .output(filePath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

describe('knowledgeBase extractionService', () => {
  let tempDir;
  let mod;

  beforeEach(async () => {
    tempDir = makeTempDir();
    process.env = { ...ORIGINAL_ENV };
    mocks.executeAIRequest.mockReset();
    mocks.transcribeAudioFile.mockReset();
    Module._load = ORIGINAL_MODULE_LOAD;
    mod = await import('../extractionService.js');
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    Module._load = ORIGINAL_MODULE_LOAD;
    vi.restoreAllMocks();
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('extracts selectable text from standard PDFs with pdf-parse v2', async () => {
    const filePath = path.join(tempDir, 'text.pdf');
    const expected = 'Green Shield selectable PDF extraction should preserve this standard business text.';
    await writeTextPdf(filePath, expected);

    const result = await mod.extractPdf(filePath);

    expect(result.text).toContain('Green Shield selectable PDF extraction');
    expect(result.wordCount).toBeGreaterThan(8);
    expect(result.metadata.pages).toBe(1);
    expect(result.metadata.error).toBeUndefined();
  });

  it('falls back to OCR for PDFs without selectable text when Anthropic is configured', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mocks.executeAIRequest.mockResolvedValue({
      text: 'TYPE: Scanned sales note\n---\nScanned PDF OCR text for Green Shield.',
    });
    const filePath = path.join(tempDir, 'scanned.pdf');
    await writeImageOnlyPdf(filePath);

    const result = await mod.extractPdf(filePath);

    expect(result.text).toContain('Scanned PDF OCR text');
    expect(result.wordCount).toBeGreaterThan(5);
    expect(result.metadata.ocr).toBe(true);
    expect(result.metadata.pdfOcr).toBe(true);
    expect(result.metadata.pagesOcrAttempted).toBe(1);
    expect(mocks.executeAIRequest).toHaveBeenCalledTimes(1);
    const [payload] = mocks.executeAIRequest.mock.calls[0];
    expect(payload.provider).toBe('anthropic');
    expect(payload.model).toBe('claude-haiku-4-5-20251001');
    expect(payload.maxTokens).toBe(4096);
    expect(payload.endpoint).toBe('knowledge-base-extraction');
    expect(payload.feature).toBe('knowledge-base-extraction');
    expect(payload.metadata).toEqual({
      source: 'extractionService',
      purpose: 'ocr',
    });
    const content = payload.messages[0].content;
    expect(content.some((part) => part.type === 'image' && part.source.media_type === 'image/png')).toBe(true);
    expect(content.at(-1).text).toContain('You are an OCR and content extraction assistant for a pest control sales company.');
    expect(content.at(-1).text).toContain('Format your response as:');
  });

  it('preserves OCR provider failure behavior without logging document contents', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mocks.executeAIRequest.mockRejectedValue(new Error('provider unavailable'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const imagePath = path.join(tempDir, 'sensitive.png');
    const png = new PNG({ width: 4, height: 4 });
    fs.writeFileSync(imagePath, PNG.sync.write(png));

    const result = await mod.extractImageOcr(imagePath, 'image/png', 'Sensitive Image');

    expect(result).toEqual({
      text: '[Sensitive Image OCR failed: provider unavailable]',
      wordCount: 0,
      metadata: { error: 'provider unavailable', ocr: true },
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('preserves error details for malformed PDFs', async () => {
    const filePath = path.join(tempDir, 'malformed.pdf');
    fs.writeFileSync(filePath, Buffer.from('%PDF-1.4\nthis is not a valid pdf body\n'));

    const result = await mod.extractPdf(filePath);

    expect(result.wordCount).toBe(0);
    expect(result.text).toMatch(/^\[PDF extraction failed:/);
    expect(result.metadata.error).toBeTruthy();
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('does not regress plain text, markdown, and csv extraction dispatch', async () => {
    const txtPath = path.join(tempDir, 'note.txt');
    const mdPath = path.join(tempDir, 'playbook.md');
    const csvPath = path.join(tempDir, 'pricing.csv');
    fs.writeFileSync(txtPath, 'Green Shield plain text knowledge survives extraction.');
    fs.writeFileSync(mdPath, '# Sales Playbook\n\nUse value framing.');
    fs.writeFileSync(csvPath, 'service,price\nInitial Service,199\nRecurring,69\n');

    await expect(mod.extractContent(txtPath, 'text/plain', 'note.txt')).resolves.toMatchObject({
      text: 'Green Shield plain text knowledge survives extraction.',
    });
    await expect(mod.extractContent(mdPath, 'text/markdown', 'playbook.md')).resolves.toMatchObject({
      wordCount: 6,
    });
    const csv = await mod.extractContent(csvPath, 'text/csv', 'pricing.csv');
    expect(csv.text).toContain('Initial Service');
    expect(csv.text).toContain('Recurring');
  });

  it('transcribes audio under the configured size limit without splitting', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MEDIA_TRANSCRIPTION_MAX_BYTES = '5000000';
    mocks.transcribeAudioFile.mockResolvedValue({
      text: 'Short training audio transcript.',
      segments: [{ id: 1 }],
      language: 'en',
      duration: 1,
    });
    const audioPath = path.join(tempDir, 'short.mp3');
    await writeTestAudio(audioPath, 1);

    const result = await mod.extractAudio(audioPath, 'short.mp3');

    expect(result.text).toBe('Short training audio transcript.');
    expect(result.metadata.split).toBe(false);
    expect(result.metadata.fileSize).toBe(fs.statSync(audioPath).size);
    expect(mocks.transcribeAudioFile).toHaveBeenCalledTimes(1);
    expect(mocks.transcribeAudioFile).toHaveBeenCalledWith(audioPath);
    expect(fs.existsSync(audioPath)).toBe(true);
  });

  it('splits oversized audio and merges chunk transcripts in order with timestamps', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MEDIA_TRANSCRIPTION_MAX_BYTES = '50000';
    mocks.transcribeAudioFile.mockImplementation(async () => {
      const index = mocks.transcribeAudioFile.mock.calls.length;
      return {
        text: `Segment ${index} transcript.`,
        segments: [{ id: index }],
        language: 'en',
        duration: 5,
      };
    });
    const audioPath = path.join(tempDir, 'long.mp3');
    await writeTestAudio(audioPath, 12, '128k');

    const result = await mod.extractAudio(audioPath, 'long.mp3');

    expect(result.metadata.split).toBe(true);
    expect(result.metadata.chunkCount).toBeGreaterThan(1);
    expect(mocks.transcribeAudioFile.mock.calls.length).toBe(result.metadata.chunkCount);
    expect(result.text).toContain('[00:00:00] Segment 1 transcript.');
    expect(result.text).toContain('[00:00:05] Segment 2 transcript.');
    expect(result.text.indexOf('Segment 1 transcript')).toBeLessThan(result.text.indexOf('Segment 2 transcript'));
    expect(fs.existsSync(audioPath)).toBe(true);
  });

  it('returns a clear error when oversized audio cannot be split because ffmpeg is unavailable', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MEDIA_TRANSCRIPTION_MAX_BYTES = '1';
    const audioPath = path.join(tempDir, 'too-large.mp3');
    fs.writeFileSync(audioPath, Buffer.alloc(2048));
    Module._load = function patchedLoad(request, ...args) {
      if (request === 'ffmpeg-static') return null;
      return ORIGINAL_MODULE_LOAD.call(this, request, ...args);
    };

    const result = await mod.extractAudio(audioPath, 'too-large.mp3');

    expect(result.text).toBe('[Audio file is too large and ffmpeg is not available to split it.]');
    expect(result.metadata.error).toBe('Audio file is too large and ffmpeg is not available to split it.');
    expect(result.metadata.code).toBe('FFMPEG_UNAVAILABLE');
    expect(mocks.transcribeAudioFile).not.toHaveBeenCalled();
    expect(fs.existsSync(audioPath)).toBe(true);
  });

  it('preserves audio transcription failure details and the original upload', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MEDIA_TRANSCRIPTION_MAX_BYTES = '5000000';
    mocks.transcribeAudioFile.mockRejectedValue(new Error('413 Maximum content size limit exceeded'));
    const audioPath = path.join(tempDir, 'failed.mp3');
    await writeTestAudio(audioPath, 1);

    const result = await mod.extractAudio(audioPath, 'failed.mp3');

    expect(result.text).toBe('[Audio transcription failed: 413 Maximum content size limit exceeded]');
    expect(result.metadata.error).toBe('413 Maximum content size limit exceeded');
    expect(fs.existsSync(audioPath)).toBe(true);
  });

  it('uses the same splitting path for oversized extracted video audio', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MEDIA_TRANSCRIPTION_MAX_BYTES = '30000';
    mocks.transcribeAudioFile.mockImplementation(async () => {
      const index = mocks.transcribeAudioFile.mock.calls.length;
      return {
        text: `Video segment ${index} transcript.`,
        segments: [{ id: index }],
        language: 'en',
        duration: 3,
      };
    });
    const videoPath = path.join(tempDir, 'training.mp4');
    await writeTestVideo(videoPath, 8);

    const result = await mod.extractVideo(videoPath);

    expect(result.metadata.videoExtracted).toBe(true);
    expect(result.metadata.split).toBe(true);
    expect(result.metadata.chunkCount).toBeGreaterThan(1);
    expect(result.text).toContain('[00:00:00] Video segment 1 transcript.');
    expect(result.text).toContain('[00:00:03] Video segment 2 transcript.');
    expect(fs.existsSync(videoPath)).toBe(true);
  });

  it('does not import provider SDKs directly from extractionService.js', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'extractionService.js'), 'utf8');
    expect(source).not.toContain('@anthropic-ai/sdk');
    expect(source).not.toContain("from 'openai'");
    expect(source).not.toContain('from "openai"');
    expect(source).not.toContain('messages.create');
    expect(source).not.toContain('audio.transcriptions.create');
    expect(source).toContain("from '../ai/execution/AIExecutionEngine.js'");
    expect(source).toContain("from '../ai/extraction/transcriptionProvider.js'");
  });
});
