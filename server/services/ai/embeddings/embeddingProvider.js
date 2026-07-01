import OpenAI from 'openai';
import { recordAIUsage } from '../AIUsageRecorder.js';

let openai = null;

function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Add it to server/.env to enable semantic retrieval.');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  }
  return openai;
}

export function resetEmbeddingProviderForTests() {
  openai = null;
}

function computeInputSize(value) {
  if (value == null) return 0;
  if (Array.isArray(value)) {
    let total = 0;
    for (const item of value) {
      if (typeof item === 'string') total += item.length;
    }
    return total;
  }
  if (typeof value === 'string') return value.length;
  return 0;
}

function extractErrorCode(err) {
  if (!err) return 'PROVIDER_ERROR';
  if (typeof err.code === 'string' && err.code.trim()) return err.code.trim();
  if (Number.isFinite(err.status)) return `HTTP_${err.status}`;
  if (typeof err.name === 'string' && err.name.trim()) return err.name.trim();
  return 'PROVIDER_ERROR';
}

export async function createEmbeddings({
  input,
  inputs,
  model,
  dimensions,
  signal,
} = {}) {
  const payload = {
    model,
    input: inputs ?? input,
  };
  if (dimensions != null) payload.dimensions = dimensions;

  const inputSize = computeInputSize(payload.input);
  const inputCount = Array.isArray(payload.input) ? payload.input.length : payload.input == null ? 0 : 1;
  const start = Date.now();

  try {
    const response = await getOpenAI().embeddings.create(payload, { signal });
    const vectorCount = Array.isArray(response?.data) ? response.data.length : 0;
    safeRecordUsage({
      endpoint: 'openai.embeddings.create',
      feature: 'embeddings',
      provider: 'openai',
      model: model || null,
      durationMs: Date.now() - start,
      inputSize,
      outputSize: vectorCount,
      success: true,
      metadata: { inputCount },
    });
    return response;
  } catch (err) {
    safeRecordUsage({
      endpoint: 'openai.embeddings.create',
      feature: 'embeddings',
      provider: 'openai',
      model: model || null,
      durationMs: Date.now() - start,
      inputSize,
      outputSize: 0,
      success: false,
      errorCode: extractErrorCode(err),
      metadata: { inputCount },
    });
    throw err;
  }
}

function safeRecordUsage(entry) {
  try {
    recordAIUsage(entry);
  } catch (persistenceError) {
    console.warn('[embeddings] usage persistence failed:', persistenceError?.message || persistenceError);
  }
}

export default {
  createEmbeddings,
};
