import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { recordAIUsage } from '../AIUsageRecorder.js';

let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });
  }
  return openai;
}

export function resetTranscriptionProviderForTests() {
  openai = null;
}

function safeFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function safeExtension(filePath) {
  try {
    return path.extname(String(filePath || '')).toLowerCase().replace(/^\./, '') || null;
  } catch {
    return null;
  }
}

function extractErrorCode(err) {
  if (!err) return 'PROVIDER_ERROR';
  if (typeof err.code === 'string' && err.code.trim()) return err.code.trim();
  if (Number.isFinite(err.status)) return `HTTP_${err.status}`;
  if (typeof err.name === 'string' && err.name.trim()) return err.name.trim();
  return 'PROVIDER_ERROR';
}

export async function transcribeAudioFile(filePath) {
  const inputSize = safeFileSize(filePath);
  const extension = safeExtension(filePath);
  const fileStream = fs.createReadStream(filePath);
  fileStream.on('error', () => {});
  const start = Date.now();
  try {
    const response = await getOpenAI().audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
    const outputSize = typeof response?.text === 'string' ? response.text.length : 0;
    safeRecordUsage({
      endpoint: 'openai.audio.transcriptions.create',
      feature: 'transcription',
      provider: 'openai',
      model: 'whisper-1',
      durationMs: Date.now() - start,
      inputSize,
      outputSize,
      success: true,
      metadata: { fileSizeBytes: inputSize, extension },
    });
    return response;
  } catch (err) {
    safeRecordUsage({
      endpoint: 'openai.audio.transcriptions.create',
      feature: 'transcription',
      provider: 'openai',
      model: 'whisper-1',
      durationMs: Date.now() - start,
      inputSize,
      outputSize: 0,
      success: false,
      errorCode: extractErrorCode(err),
      metadata: { fileSizeBytes: inputSize, extension },
    });
    throw err;
  } finally {
    fileStream.destroy();
  }
}

function safeRecordUsage(entry) {
  try {
    recordAIUsage(entry);
  } catch (persistenceError) {
    console.warn('[transcription] usage persistence failed:', persistenceError?.message || persistenceError);
  }
}

export default {
  transcribeAudioFile,
};
