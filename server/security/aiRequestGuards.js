import { recordAiMetric } from '../services/aiOperationalMetrics.js';

export const GENERIC_AI_ERROR = 'Unable to generate a response right now. Please try again.';

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAiConfig() {
  return {
    rateLimitMax: parsePositiveInt(process.env.AI_RATE_LIMIT_MAX, 20),
    rateLimitWindowMs: parsePositiveInt(process.env.AI_RATE_LIMIT_WINDOW_MS, 60_000),
    maxPromptChars: parsePositiveInt(process.env.AI_MAX_PROMPT_CHARS, 60_000),
    maxResponseChars: parsePositiveInt(process.env.AI_MAX_RESPONSE_CHARS, 6_000),
    timeoutMs: parsePositiveInt(process.env.AI_TIMEOUT_MS, 60_000),
    maxOutputTokens: parsePositiveInt(process.env.AI_MAX_OUTPUT_TOKENS, Number.MAX_SAFE_INTEGER),
  };
}

export class AiHttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'AiHttpError';
    this.status = status;
    this.code = code;
  }
}

export function getAuthenticatedUser(req = {}) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Basic ')) {
    try {
      const credentials = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
      const separatorIndex = credentials.indexOf(':');
      if (separatorIndex > 0) {
        return credentials.slice(0, separatorIndex);
      }
    } catch {
      // Fall through to IP fallback.
    }
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createAiRateLimiter() {
  const buckets = new Map();

  return function aiRateLimiter(req, res, next) {
    const config = getAiConfig();
    const now = Date.now();
    const user = getAuthenticatedUser(req);
    const endpoint = req.originalUrl || req.path || 'unknown';
    const key = `${user}:${req.baseUrl || ''}${req.path || endpoint}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + config.rateLimitWindowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= config.rateLimitMax) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      recordAiMetric({
        user,
        endpoint,
        module: req.aiModule || null,
        durationMs: 0,
        success: false,
        failure: true,
        rateLimited: true,
      });
      return res.status(429).json({ error: 'Too many AI requests. Please try again shortly.' });
    }

    bucket.count += 1;
    return next();
  };
}

export function assertPlainObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AiHttpError(400, 'Request body must be a JSON object.', 'INVALID_BODY');
  }
}

export function assertNonEmptyString(value, fieldName, message = `${fieldName} is required`) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AiHttpError(400, message, 'INVALID_FIELD');
  }
  return value.trim();
}

export function assertObject(value, fieldName, message = `${fieldName} must be an object`) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiHttpError(400, message, 'INVALID_FIELD');
  }
  return value;
}

export function estimateTextLength(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return value.length;
  try {
    return JSON.stringify(value).length;
  } catch {
    return String(value).length;
  }
}

export function assertPromptWithinLimit(value, label = 'prompt') {
  const length = estimateTextLength(value);
  const { maxPromptChars } = getAiConfig();
  if (length > maxPromptChars) {
    throw new AiHttpError(
      413,
      `${label} exceeds the maximum allowed size of ${maxPromptChars} characters.`,
      'PROMPT_TOO_LARGE',
    );
  }
  return length;
}

export function truncateAiText(value) {
  if (typeof value !== 'string') return '';
  const { maxResponseChars } = getAiConfig();
  if (value.length <= maxResponseChars) return value;
  return `${value.slice(0, Math.max(0, maxResponseChars - 15)).trimEnd()} [truncated]`;
}

export function getConfiguredMaxTokens(defaultMaxTokens) {
  return Math.min(defaultMaxTokens, getAiConfig().maxOutputTokens);
}

export async function runAiOperation({
  req = null,
  endpoint = null,
  module = null,
  provider = null,
  model = null,
  promptLength = 0,
  operation,
}) {
  const config = getAiConfig();
  const controller = new AbortController();
  const start = Date.now();
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  try {
    const result = await operation({ signal: controller.signal });
    const responseLength = estimateTextLength(result);
    recordAiMetric({
      user: getAuthenticatedUser(req || {}),
      endpoint: endpoint || req?.originalUrl || req?.path || 'internal',
      module,
      provider,
      model,
      promptLength,
      responseLength,
      durationMs: Date.now() - start,
      success: true,
      failure: false,
      timeout: false,
    });
    return result;
  } catch (err) {
    const isTimeout = timedOut || err?.name === 'AbortError';
    recordAiMetric({
      user: getAuthenticatedUser(req || {}),
      endpoint: endpoint || req?.originalUrl || req?.path || 'internal',
      module,
      provider,
      model,
      promptLength,
      responseLength: 0,
      durationMs: Date.now() - start,
      success: false,
      failure: true,
      timeout: isTimeout,
    });

    if (isTimeout) {
      throw new AiHttpError(504, 'AI request timed out. Please try again.', 'AI_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function sendAiError(res, err, logContext = {}) {
  if (err instanceof AiHttpError || err?.status === 400 || err?.status === 413 || err?.status === 504) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error('[ai-error]', JSON.stringify({
    endpoint: logContext.endpoint || null,
    module: logContext.module || null,
    provider: logContext.provider || null,
    model: logContext.model || null,
    code: err?.code || null,
    name: err?.name || null,
    message: err?.message || String(err),
  }));

  return res.status(500).json({ error: GENERIC_AI_ERROR });
}
