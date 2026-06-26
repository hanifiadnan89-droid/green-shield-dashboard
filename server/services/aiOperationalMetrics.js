const DEFAULT_MAX_EVENTS = 500;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const maxEvents = parsePositiveInt(process.env.AI_METRICS_MAX_EVENTS, DEFAULT_MAX_EVENTS);
const recentEvents = [];

const counters = {
  requests: 0,
  success: 0,
  failure: 0,
  timeout: 0,
  rateLimited: 0,
};

function sanitizeMetricEvent(event = {}) {
  return {
    timestamp: event.timestamp || new Date().toISOString(),
    user: event.user || 'unknown',
    endpoint: event.endpoint || 'unknown',
    module: event.module || null,
    provider: event.provider || null,
    model: event.model || null,
    promptLength: Number(event.promptLength || 0),
    responseLength: Number(event.responseLength || 0),
    estimatedInputSize: Number(event.estimatedInputSize ?? event.promptLength ?? 0),
    estimatedOutputSize: Number(event.estimatedOutputSize ?? event.responseLength ?? 0),
    durationMs: Number(event.durationMs || 0),
    success: Boolean(event.success),
    failure: Boolean(event.failure),
    timeout: Boolean(event.timeout),
    rateLimited: Boolean(event.rateLimited),
  };
}

export function recordAiMetric(event) {
  const safeEvent = sanitizeMetricEvent(event);

  counters.requests += 1;
  if (safeEvent.success) counters.success += 1;
  if (safeEvent.failure) counters.failure += 1;
  if (safeEvent.timeout) counters.timeout += 1;
  if (safeEvent.rateLimited) counters.rateLimited += 1;

  recentEvents.push(safeEvent);
  while (recentEvents.length > maxEvents) {
    recentEvents.shift();
  }

  console.log('[ai-metric]', JSON.stringify(safeEvent));
  return safeEvent;
}

export function getAiMetricsSnapshot() {
  return {
    counters: { ...counters },
    recentEvents: recentEvents.slice(),
  };
}

export function resetAiMetricsForTest() {
  recentEvents.length = 0;
  counters.requests = 0;
  counters.success = 0;
  counters.failure = 0;
  counters.timeout = 0;
  counters.rateLimited = 0;
}
