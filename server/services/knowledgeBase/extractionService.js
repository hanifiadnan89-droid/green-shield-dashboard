/**
 * Extraction Service — pulls raw text from every supported source type.
 *
 * Returns { text: string, wordCount: number, metadata: object }
 * Never throws on partial failure — always returns what it can with an error note.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── Lazy clients ──────────────────────────────────────────────────────────────

let _anthropic = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return _anthropic;
}

let _openai = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });
  return _openai;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function cleanText(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{3,}/g, '  ')
    .trim();
}

const DEFAULT_MEDIA_TRANSCRIPTION_MAX_BYTES = 24000000;
const TRANSCRIPTION_AUDIO_BITRATE_BYTES_PER_SECOND = 8000; // 64k output.
const TRANSCRIPTION_SEGMENT_SECONDS_CAP = 15 * 60;

function getMediaTranscriptionMaxBytes() {
  const configured = Number.parseInt(process.env.MEDIA_TRANSCRIPTION_MAX_BYTES || '', 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MEDIA_TRANSCRIPTION_MAX_BYTES;
}

function getTranscriptionSegmentSeconds(maxBytes) {
  const estimatedSafeSeconds = Math.floor((maxBytes * 0.8) / TRANSCRIPTION_AUDIO_BITRATE_BYTES_PER_SECOND);
  return Math.max(1, Math.min(TRANSCRIPTION_SEGMENT_SECONDS_CAP, estimatedSafeSeconds));
}

function formatTimestamp(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function loadFfmpeg() {
  try {
    const ffmpegStatic = require('ffmpeg-static');
    const ffmpeg = require('fluent-ffmpeg');
    if (!ffmpegStatic) throw new Error('ffmpeg-static did not provide a binary path');
    ffmpeg.setFfmpegPath(ffmpegStatic);
    return ffmpeg;
  } catch (err) {
    const unavailable = new Error('Audio file is too large and ffmpeg is not available to split it.');
    unavailable.code = 'FFMPEG_UNAVAILABLE';
    unavailable.cause = err;
    throw unavailable;
  }
}

async function transcribeAudioFile(filePath) {
  const fileStream = fs.createReadStream(filePath);
  fileStream.on('error', () => {});
  try {
    return await getOpenAI().audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
  } finally {
    fileStream.destroy();
  }
}

async function splitMediaForTranscription(filePath, maxBytes) {
  const ffmpeg = loadFfmpeg();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-kb-media-chunks-'));
  const segmentSeconds = getTranscriptionSegmentSeconds(maxBytes);
  const outputPattern = path.join(tempDir, 'chunk-%03d.mp3');

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .audioChannels(1)
        .audioFrequency(16000)
        .outputOptions([
          '-f segment',
          `-segment_time ${segmentSeconds}`,
          '-reset_timestamps 1',
        ])
        .output(outputPattern)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const chunks = fs.readdirSync(tempDir)
      .filter((name) => /^chunk-\d+\.mp3$/.test(name))
      .sort()
      .map((name, index) => ({
        path: path.join(tempDir, name),
        offsetSeconds: index * segmentSeconds,
        size: fs.statSync(path.join(tempDir, name)).size,
      }));

    if (!chunks.length) {
      throw new Error('ffmpeg did not create any transcription chunks');
    }

    return { tempDir, chunks, segmentSeconds };
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
}

// ── Plain text ────────────────────────────────────────────────────────────────

export async function extractPlainText(filePath) {
  const text = cleanText(fs.readFileSync(filePath, 'utf-8'));
  return { text, wordCount: countWords(text), metadata: {} };
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function extractPdf(filePath) {
  let parser = null;
  try {
    const { PDFParse } = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text   = cleanText(result.text);
    if (text.length < 50) {
      return extractPdfOcr(buffer, result.total || 1);
    }
    return { text, wordCount: countWords(text), metadata: { pages: result.total } };
  } catch (err) {
    return { text: `[PDF extraction failed: ${err.message}]`, wordCount: 0, metadata: { error: err.message } };
  } finally {
    try { await parser?.destroy?.(); } catch {}
  }
}

// ── DOCX ──────────────────────────────────────────────────────────────────────

export async function extractDocx(filePath) {
  try {
    const mammoth = require('mammoth');
    const result  = await mammoth.extractRawText({ path: filePath });
    const text    = cleanText(result.value);
    return { text, wordCount: countWords(text), metadata: {} };
  } catch (err) {
    return { text: `[DOCX extraction failed: ${err.message}]`, wordCount: 0, metadata: { error: err.message } };
  }
}

// ── XLSX / CSV ────────────────────────────────────────────────────────────────

export async function extractSpreadsheet(filePath, ext) {
  try {
    const XLSX = require('xlsx');
    const wb   = XLSX.readFile(filePath);
    const lines = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const csv   = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) lines.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
    const text = cleanText(lines.join('\n\n'));
    return { text, wordCount: countWords(text), metadata: { sheets: wb.SheetNames } };
  } catch (err) {
    return { text: `[Spreadsheet extraction failed: ${err.message}]`, wordCount: 0, metadata: { error: err.message } };
  }
}

// ── PPTX / Office ─────────────────────────────────────────────────────────────

export async function extractOffice(filePath) {
  try {
    const officeparser = require('officeparser');
    const text = await new Promise((resolve, reject) => {
      officeparser.parseOffice(filePath, (data, err) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    const cleaned = cleanText(text);
    return { text: cleaned, wordCount: countWords(cleaned), metadata: {} };
  } catch (err) {
    return { text: `[Office file extraction failed: ${err.message}]`, wordCount: 0, metadata: { error: err.message } };
  }
}

// ── Image OCR via Claude ──────────────────────────────────────────────────────

async function extractImageBuffersOcr(images, label = 'Image', extraMetadata = {}) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        text: `[${label} OCR requires ANTHROPIC_API_KEY]`,
        wordCount: 0,
        metadata: { error: 'No Anthropic key', ocr: true, ...extraMetadata },
      };
    }

    const imageBlocks = images.map(({ buffer, mimeType }) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
        data: Buffer.from(buffer).toString('base64'),
      },
    }));

    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `You are an OCR and content extraction assistant for a pest control sales company.

Extract ALL text from this ${label}. If it is a sales conversation screenshot, capture every message verbatim. If it is a whiteboard, diagram, pricing sheet, or handwritten note, transcribe all visible text and describe any diagrams or charts.

Also note: what TYPE of content is this? (e.g., "Sales conversation", "Pricing sheet", "Whiteboard diagram", "Handwritten notes", "Competitor info", etc.)

Format your response as:
TYPE: [content type]
---
[extracted text / transcription]`,
          },
        ],
      }],
    });

    const rawText  = response.content[0]?.text || '';
    const text     = cleanText(rawText);
    return {
      text,
      wordCount: countWords(text),
      metadata: { ocr: true, model: 'claude-haiku-4-5-20251001', ...extraMetadata },
    };
  } catch (err) {
    return { text: `[${label} OCR failed: ${err.message}]`, wordCount: 0, metadata: { error: err.message, ocr: true, ...extraMetadata } };
  }
}

async function extractPdfOcr(buffer, pageCount) {
  let parser = null;
  try {
    const { PDFParse } = require('pdf-parse');
    parser = new PDFParse({ data: buffer });
    const pagesToRender = Math.max(1, Math.min(Number(pageCount) || 1, 3));
    const screenshots = await parser.getScreenshot({
      first: pagesToRender,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const images = (screenshots.pages || [])
      .filter((page) => page.data)
      .map((page) => ({ buffer: page.data, mimeType: 'image/png' }));
    if (!images.length) {
      return { text: '[PDF OCR failed: no rendered pages available]', wordCount: 0, metadata: { error: 'No rendered pages', ocr: true } };
    }
    return extractImageBuffersOcr(images, 'PDF pages (scanned — OCR)', {
      pdfOcr: true,
      pages: pageCount,
      pagesOcrAttempted: images.length,
    });
  } catch (err) {
    return { text: `[PDF OCR failed: ${err.message}]`, wordCount: 0, metadata: { error: err.message, ocr: true, pdfOcr: true } };
  } finally {
    try { await parser?.destroy?.(); } catch {}
  }
}

export async function extractImageOcr(filePath, mimeType = 'image/jpeg', label = 'Image') {
  const buffer = fs.readFileSync(filePath);
  const safeMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  return extractImageBuffersOcr([{ buffer, mimeType: safeMime }], label);
}

// ── Audio transcription via Whisper ──────────────────────────────────────────

export async function extractAudio(filePath, originalName) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { text: '[Audio transcription requires OPENAI_API_KEY]', wordCount: 0, metadata: { error: 'No OpenAI key' } };
    }
    const maxBytes = getMediaTranscriptionMaxBytes();
    const fileSize = fs.statSync(filePath).size;

    if (fileSize <= maxBytes) {
      const transcription = await transcribeAudioFile(filePath);
      const text = cleanText(transcription.text || '');
      const segments = (transcription.segments || []).length;
      return {
        text,
        wordCount: countWords(text),
        metadata: {
          segments,
          language: transcription.language,
          duration: transcription.duration,
          fileSize,
          transcriptionMaxBytes: maxBytes,
          split: false,
        },
      };
    }

    const split = await splitMediaForTranscription(filePath, maxBytes);
    try {
      const transcriptParts = [];
      let segments = 0;
      let duration = 0;
      let language;

      for (const chunk of split.chunks) {
        if (chunk.size > maxBytes) {
          throw new Error(`Transcription chunk exceeds configured size limit (${chunk.size} bytes > ${maxBytes} bytes)`);
        }

        const transcription = await transcribeAudioFile(chunk.path);
        const text = cleanText(transcription.text || '');
        if (text) {
          transcriptParts.push(`[${formatTimestamp(chunk.offsetSeconds)}] ${text}`);
        }
        segments += (transcription.segments || []).length;
        duration += Number(transcription.duration) || 0;
        if (!language && transcription.language) language = transcription.language;
      }

      const text = cleanText(transcriptParts.join('\n\n'));
      return {
        text,
        wordCount: countWords(text),
        metadata: {
          segments,
          language,
          duration,
          fileSize,
          transcriptionMaxBytes: maxBytes,
          split: true,
          chunkCount: split.chunks.length,
          chunkSeconds: split.segmentSeconds,
          originalName,
        },
      };
    } finally {
      fs.rmSync(split.tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    const message = err.code === 'FFMPEG_UNAVAILABLE'
      ? err.message
      : `Audio transcription failed: ${err.message}`;
    return {
      text: `[${message}]`,
      wordCount: 0,
      metadata: { error: err.message, code: err.code },
    };
  }
}

// ── Video: extract audio + transcribe ─────────────────────────────────────────

export async function extractVideo(filePath) {
  if (!process.env.OPENAI_API_KEY) {
    return { text: '[Video transcription requires OPENAI_API_KEY]', wordCount: 0, metadata: { error: 'No OpenAI key' } };
  }

  const audioPath = filePath + '.extracted.mp3';
  try {
    // Extract audio with fluent-ffmpeg using ffmpeg-static binary
    const ffmpegStatic = require('ffmpeg-static');
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegStatic);

    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .audioChannels(1)
        .audioFrequency(16000)
        .output(audioPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const result = await extractAudio(audioPath, 'extracted.mp3');
    return { ...result, metadata: { ...result.metadata, videoExtracted: true } };
  } catch (err) {
    return { text: `[Video extraction failed: ${err.message}]`, wordCount: 0, metadata: { error: err.message } };
  } finally {
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
}

// ── URL scraping ──────────────────────────────────────────────────────────────

export async function extractUrl(url) {
  // YouTube special handling
  if (/youtube\.com\/watch|youtu\.be\//.test(url)) {
    return extractYoutube(url);
  }

  try {
    const cheerio = require('cheerio');
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GreenShieldBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const $    = cheerio.load(html);

    // Remove noise elements
    $('script, style, nav, footer, header, aside, .nav, .footer, .sidebar, .menu, .ad, .ads, [class*="cookie"], [class*="popup"]').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || url;
    const text  = cleanText($('body').text());
    return { text, wordCount: countWords(text), metadata: { title, url, scraped: true } };
  } catch (err) {
    return { text: `[URL fetch failed: ${err.message}]`, wordCount: 0, metadata: { error: err.message, url } };
  }
}

// ── YouTube transcript ────────────────────────────────────────────────────────

export async function extractYoutube(url) {
  try {
    const { YoutubeTranscript } = require('youtube-transcript');

    // Extract video ID
    const idMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (!idMatch) throw new Error('Could not parse YouTube video ID');
    const videoId = idMatch[1];

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const lines = transcript.map(t => t.text).join(' ');
    const text  = cleanText(lines);

    return {
      text,
      wordCount: countWords(text),
      metadata: { videoId, url, youtubeTranscript: true, segmentCount: transcript.length },
    };
  } catch (err) {
    // Fall back to URL scraping (might get auto-generated captions page)
    return { text: `[YouTube transcript failed: ${err.message}. Try uploading the video file directly for audio transcription.]`, wordCount: 0, metadata: { error: err.message, url } };
  }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function extractContent(filePath, mimeType, originalName) {
  const ext = (originalName || '').split('.').pop().toLowerCase();

  // Plain text
  if (['txt', 'md', 'rtf', 'markdown'].includes(ext) || mimeType === 'text/plain') {
    return extractPlainText(filePath);
  }

  // PDF
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return extractPdf(filePath);
  }

  // Word
  if (['doc', 'docx'].includes(ext) || mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
    return ext === 'docx' ? extractDocx(filePath) : extractOffice(filePath);
  }

  // Spreadsheet
  if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType === 'text/csv') {
    return extractSpreadsheet(filePath, ext);
  }

  // PowerPoint
  if (['pptx', 'ppt'].includes(ext) || mimeType.includes('presentation')) {
    return extractOffice(filePath);
  }

  // Images
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) || mimeType.startsWith('image/')) {
    const safeMime = mimeType.startsWith('image/') ? mimeType : `image/${ext}`;
    return extractImageOcr(filePath, safeMime, 'Image');
  }

  // Audio
  if (['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'].includes(ext) || mimeType.startsWith('audio/')) {
    return extractAudio(filePath, originalName);
  }

  // Video
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || mimeType.startsWith('video/')) {
    return extractVideo(filePath);
  }

  return { text: `[Unsupported file type: ${ext || mimeType}]`, wordCount: 0, metadata: { error: 'Unsupported type' } };
}
