import Anthropic from '@anthropic-ai/sdk';
import {
  AiHttpError,
  assertPromptWithinLimit,
  estimateTextLength,
  getConfiguredMaxTokens,
  runAiOperation,
} from '../../../security/aiRequestGuards.js';
import { recordAIUsage } from '../AIUsageRecorder.js';

export class AIExecutionError extends AiHttpError {
  constructor(status, message, code) {
    super(status, message, code);
    this.name = 'AIExecutionError';
  }
}

let anthropic = null;

function getAnthropicClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AIExecutionError(500, 'AI provider is not configured.', 'AI_PROVIDER_NOT_CONFIGURED');
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  }
  return anthropic;
}

export function resetAIExecutionEngineForTests() {
  anthropic = null;
}

function normalizeProvider(provider) {
  const normalized = String(provider || 'anthropic').trim().toLowerCase();
  if (normalized !== 'anthropic') {
    throw new AIExecutionError(400, `Unsupported AI provider: ${provider}`, 'AI_PROVIDER_UNSUPPORTED');
  }
  return normalized;
}

function normalizeMessages(messages) {
  if (Array.isArray(messages)) return messages;
  if (typeof messages === 'string') return [{ role: 'user', content: messages }];
  return [];
}

function extractAnthropicText(response) {
  return (response?.content || [])
    .map((part) => part?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseJsonText(text) {
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch {
    throw new AIExecutionError(502, 'AI returned an unexpected format. Please try again.', 'AI_INVALID_JSON');
  }
}

function mapProviderError(err) {
  if (err instanceof AiHttpError) return err;

  const status = Number(err?.status || err?.statusCode) || 0;
  if (status === 401 || status === 403) {
    return new AIExecutionError(500, 'AI provider is not configured.', 'AI_PROVIDER_AUTH_FAILED');
  }
  if (status === 429) {
    return new AIExecutionError(503, 'AI provider is temporarily unavailable. Please try again.', 'AI_PROVIDER_RATE_LIMIT');
  }
  if (status >= 500) {
    return new AIExecutionError(503, 'AI provider is temporarily unavailable. Please try again.', 'AI_PROVIDER_UNAVAILABLE');
  }

  return new AIExecutionError(502, 'AI provider request failed. Please try again.', 'AI_PROVIDER_ERROR');
}

function extractRequestId(req) {
  if (!req) return null;
  if (typeof req.id === 'string' && req.id.trim()) return req.id.trim();
  const header = req.headers && req.headers['x-request-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return null;
}

function logExecution({
  success,
  errorCode = null,
  endpoint,
  feature,
  provider,
  model,
  durationMs,
  inputSize,
  outputSize = 0,
  requestId = null,
  usageMetadata = null,
}) {
  const timestamp = new Date().toISOString();
  console.info('[ai-execution]', JSON.stringify({
    timestamp,
    endpoint: endpoint || null,
    feature: feature || null,
    provider,
    model,
    durationMs,
    inputSize,
    outputSize,
    success,
    failure: !success,
    errorCode,
  }));

  try {
    recordAIUsage({
      timestamp,
      endpoint: endpoint || null,
      feature: feature || null,
      provider,
      model,
      durationMs,
      inputSize,
      outputSize,
      success,
      errorCode,
      requestId,
      metadata: usageMetadata,
    });
  } catch (persistenceError) {
    console.warn('[ai-execution] usage persistence failed:', persistenceError?.message || persistenceError);
  }
}

export async function executeAIRequest({
  provider = 'anthropic',
  model,
  system = '',
  messages = [],
  maxTokens,
  temperature,
  responseFormat = null,
  parseJson = false,
  endpoint = null,
  feature = null,
  metadata = {},
  usageMetadata = null,
  req = null,
}) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedMessages = normalizeMessages(messages);
  const inputSize = estimateTextLength({ system, messages: normalizedMessages });
  const requestId = extractRequestId(req || metadata.req);
  assertPromptWithinLimit({ system, messages: normalizedMessages }, `${feature || 'AI'} prompt`);

  const start = Date.now();
  try {
    const client = getAnthropicClient();
    const payload = {
      model,
      max_tokens: getConfiguredMaxTokens(maxTokens),
      system,
      messages: normalizedMessages,
    };
    if (temperature != null) payload.temperature = temperature;

    const raw = await runAiOperation({
      req: req || metadata.req || null,
      endpoint,
      module: feature,
      provider: normalizedProvider,
      model,
      promptLength: inputSize,
      operation: ({ signal }) => client.messages.create(payload, { signal }),
    });

    const text = extractAnthropicText(raw);
    if (!text) {
      throw new AIExecutionError(502, 'AI provider returned an empty response. Please try again.', 'AI_EMPTY_RESPONSE');
    }

    const json = parseJson || responseFormat === 'json' ? parseJsonText(text) : null;
    const durationMs = Date.now() - start;
    const outputSize = estimateTextLength(text);
    logExecution({
      success: true,
      endpoint,
      feature,
      provider: normalizedProvider,
      model,
      durationMs,
      inputSize,
      outputSize,
      requestId,
      usageMetadata,
    });

    return {
      raw,
      text,
      json,
      usage: raw?.usage || null,
      provider: normalizedProvider,
      model,
      durationMs,
      endpoint,
      feature,
    };
  } catch (err) {
    const mapped = mapProviderError(err);
    logExecution({
      success: false,
      errorCode: mapped.code || 'AI_EXECUTION_ERROR',
      endpoint,
      feature,
      provider: normalizedProvider,
      model,
      durationMs: Date.now() - start,
      inputSize,
      outputSize: 0,
      requestId,
      usageMetadata,
    });
    throw mapped;
  }
}

export default {
  executeAIRequest,
};
