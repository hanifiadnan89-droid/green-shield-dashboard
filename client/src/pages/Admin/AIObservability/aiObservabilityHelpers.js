// Pure helpers for the AI Observability admin page.
// Kept free of React so they can be unit-tested in the existing
// node-environment vitest setup.

export const ENTRY_DISPLAY_FIELDS = [
  'id',
  'timestamp',
  'endpoint',
  'feature',
  'provider',
  'model',
  'durationMs',
  'inputSize',
  'outputSize',
  'success',
  'errorCode',
  'status',
  'requestId',
];

export const SAFE_METADATA_FIELDS = [
  'inputCount',
  'fileSizeBytes',
  'extension',
  'deprecatedRoute',
  'deprecatedPath',
  'replacementPath',
];

// Defense-in-depth: even though /api/ai/usage already sanitizes its output,
// strip anything resembling raw prompts, transcripts, vectors, or secrets
// in case a future backend regression leaks them.
const FORBIDDEN_KEY_PATTERN = /(prompt|message|messages|system|text|transcript|segments|raw|response|data|embedding|embeddings|secret|token|api[_-]?key|authorization|bearer|password|cookie|session)/i;

export function sanitizeEntryForDisplay(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const out = {};
  for (const field of ENTRY_DISPLAY_FIELDS) {
    if (entry[field] !== undefined) out[field] = entry[field];
  }
  if (entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)) {
    const meta = {};
    for (const key of SAFE_METADATA_FIELDS) {
      const value = entry.metadata[key];
      if (value !== undefined && value !== null && !FORBIDDEN_KEY_PATTERN.test(key)) {
        meta[key] = value;
      }
    }
    if (Object.keys(meta).length > 0) out.metadata = meta;
  }
  return out;
}

export function sanitizeEntriesForDisplay(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(sanitizeEntryForDisplay).filter(Boolean);
}

export function countDeprecatedRouteHits(entries) {
  if (!Array.isArray(entries)) return 0;
  return entries.filter((entry) => entry?.metadata?.deprecatedRoute === true).length;
}

export function computeSuccessRate(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const total = Number(summary.total) || 0;
  const success = Number(summary.success) || 0;
  if (total <= 0) return null;
  return success / total;
}

export function formatSuccessRate(rate) {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatDurationMs(value) {
  if (value == null) return '—';
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '—';
  if (num < 1000) return `${num} ms`;
  return `${(num / 1000).toFixed(2)} s`;
}

export function formatSize(value) {
  if (value == null) return '—';
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '—';
  if (num < 1024) return String(num);
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / 1024 / 1024).toFixed(2)} MB`;
}

export function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function pickMostCommon(counts) {
  if (!counts || typeof counts !== 'object') return null;
  let topKey = null;
  let topCount = 0;
  for (const [key, raw] of Object.entries(counts)) {
    const count = Number(raw) || 0;
    if (count > topCount) {
      topKey = key;
      topCount = count;
    }
  }
  return topKey ? { key: topKey, count: topCount } : null;
}

export function breakdownToRows(counts) {
  if (!counts || typeof counts !== 'object') return [];
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function buildUsageQueryParams(filters = {}) {
  const out = {};
  if (filters.feature) out.feature = filters.feature;
  if (filters.provider) out.provider = filters.provider;
  if (filters.limit) out.limit = Number(filters.limit);
  if (filters.success === 'true' || filters.success === true) out.success = true;
  else if (filters.success === 'false' || filters.success === false) out.success = false;
  return out;
}

export const HEALTH_STATUS_TONE = {
  healthy: { label: 'Healthy', tone: 'success' },
  degraded: { label: 'Degraded', tone: 'warn' },
  unconfigured: { label: 'Unconfigured', tone: 'danger' },
};

export function describeHealthStatus(status) {
  return HEALTH_STATUS_TONE[status] || { label: status || 'Unknown', tone: 'neutral' };
}

export const SAFE_STORAGE_FIELDS = ['backend', 'configured', 'source', 'render', 'production', 'inRepo', 'writeSafe', 'warning'];

// Picks only the documented safe storage status fields and computes a UI tone.
// Strips any unexpected key (e.g. filePath, dataDir) even if a future backend regression leaks them.
export function summarizeStorageStatus(status) {
  if (!status || typeof status !== 'object') return null;
  const safe = {};
  for (const key of SAFE_STORAGE_FIELDS) {
    if (status[key] !== undefined) safe[key] = status[key];
  }
  let tone = 'success';
  if (safe.writeSafe === false) tone = 'danger';
  else if (safe.inRepo === true) tone = 'warn';
  else if (safe.warning) tone = 'warn';
  return { ...safe, tone };
}

// Returns true only when api.auth.status() reports an authenticated admin with active status.
// Treats anything else (missing fields, non-admin role, inactive account, errors) as denied.
export function isAdminAuthStatus(authStatus) {
  if (!authStatus || typeof authStatus !== 'object') return false;
  if (authStatus.authenticated !== true) return false;
  const user = authStatus.currentUser;
  if (!user || typeof user !== 'object') return false;
  if (user.status && user.status !== 'active') return false;
  return user.isAdmin === true || user.role === 'admin';
}

// ---------------------------------------------------------------------------
// Stage 39 — Append-only DB readiness banner helpers
// ---------------------------------------------------------------------------

// Wider forbidden-key pattern than sanitizeEntryForDisplay's: this layer is the
// last defense before validation check details reach React. Any key that even
// hints at credentials/secrets/raw env is dropped.
const READINESS_FORBIDDEN_KEY_PATTERN = /(database[_-]?url|password|token|secret|cookie|bearer|api[_-]?key|authorization|env|raw|prompt|messages|transcript)/i;

const READINESS_CHECK_FIELDS = ['name', 'status', 'message'];

// Safe-to-render flag names we'll surface from the feature_flags check, in a
// stable order. Anything else encountered in `details.flags` is rendered too,
// but only after defense-in-depth filtering.
export const READINESS_SAFE_FLAG_NAMES = [
  'dbWriteAIUsageEnabled',
  'dbReadAIUsageEnabled',
  'dbWriteErrorLogEnabled',
  'dbReadErrorLogEnabled',
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPrimitiveRenderable(value) {
  return value === null
    || typeof value === 'boolean'
    || typeof value === 'number'
    || typeof value === 'string';
}

export function sanitizeValidationCheckForDisplay(check) {
  if (!isPlainObject(check)) return null;
  const out = {};
  for (const field of READINESS_CHECK_FIELDS) {
    if (check[field] !== undefined) out[field] = check[field];
  }
  // Allow a *small* details object through, but only safe scalar/boolean keys
  // that don't match the forbidden pattern. Nested objects are recursed once.
  if (isPlainObject(check.details)) {
    const safeDetails = {};
    for (const [key, raw] of Object.entries(check.details)) {
      if (READINESS_FORBIDDEN_KEY_PATTERN.test(key)) continue;
      if (isPrimitiveRenderable(raw)) {
        safeDetails[key] = raw;
      } else if (isPlainObject(raw)) {
        const inner = {};
        for (const [innerKey, innerVal] of Object.entries(raw)) {
          if (READINESS_FORBIDDEN_KEY_PATTERN.test(innerKey)) continue;
          if (isPrimitiveRenderable(innerVal)) inner[innerKey] = innerVal;
        }
        if (Object.keys(inner).length > 0) safeDetails[key] = inner;
      }
    }
    if (Object.keys(safeDetails).length > 0) out.details = safeDetails;
  }
  return out;
}

export function sanitizeValidationChecksForDisplay(checks) {
  if (!Array.isArray(checks)) return [];
  return checks.map(sanitizeValidationCheckForDisplay).filter(Boolean);
}

export const DB_READINESS_STATUS_TONE = {
  pass: { label: 'Pass', tone: 'success' },
  warn: { label: 'Warn', tone: 'warn' },
  fail: { label: 'Fail', tone: 'danger' },
  loading: { label: 'Loading', tone: 'neutral' },
  error: { label: 'Error', tone: 'danger' },
  unknown: { label: 'Unknown', tone: 'neutral' },
};

export function describeDbReadinessStatus(status) {
  return DB_READINESS_STATUS_TONE[status] || DB_READINESS_STATUS_TONE.unknown;
}

const READINESS_REMINDER_BY_STATUS = {
  pass: 'Safe to continue staging validation. Production write flags still require manual approval.',
  warn: 'Warnings found. Do not enable production write flags until reviewed.',
  fail: 'Do not enable DB write flags. Fix failed checks first.',
};

export function readinessReminderForStatus(status) {
  return READINESS_REMINDER_BY_STATUS[status] || '';
}

function safeCount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.trunc(num) : 0;
}

function countByStatus(checks, statusName) {
  if (!Array.isArray(checks)) return 0;
  return checks.reduce((acc, check) => (check && check.status === statusName ? acc + 1 : acc), 0);
}

export function formatCacheFreshness(cache, nowMs = Date.now()) {
  if (!isPlainObject(cache)) return null;
  const ttl = safeCount(cache.cacheTtlSeconds) || null;
  if (!cache.cached) {
    return ttl ? `Fresh result, cache TTL ${ttl}s` : 'Fresh result';
  }
  if (cache.cachedAt) {
    const cachedAtMs = new Date(cache.cachedAt).getTime();
    if (Number.isFinite(cachedAtMs)) {
      const ageSeconds = Math.max(0, Math.round((nowMs - cachedAtMs) / 1000));
      return `Cached result, refreshed ${ageSeconds}s ago`;
    }
  }
  return 'Cached result';
}

// Build a small, fully-sanitized summary object for the banner to render.
// Strips any forbidden keys defense-in-depth, computes counts + tone, and
// never includes raw env, credentials, or check details flagged by
// READINESS_FORBIDDEN_KEY_PATTERN.
export function summarizeDbReadiness(payload, { nowMs = Date.now() } = {}) {
  if (!isPlainObject(payload)) return null;
  const validation = isPlainObject(payload.validation) ? payload.validation : null;
  if (!validation) return null;

  const status = ['pass', 'warn', 'fail'].includes(validation.status) ? validation.status : 'unknown';
  const checks = sanitizeValidationChecksForDisplay(validation.checks);

  const failureCount = countByStatus(checks, 'fail');
  const warningCount = countByStatus(checks, 'warn');
  const totalChecks = checks.length;

  const flagsCheck = checks.find((c) => c && c.name === 'feature_flags');
  const rawFlags = (flagsCheck && isPlainObject(flagsCheck.details) && isPlainObject(flagsCheck.details.flags))
    ? flagsCheck.details.flags
    : null;
  const flags = rawFlags
    ? Object.fromEntries(
      Object.entries(rawFlags).filter(([key, value]) => (
        !READINESS_FORBIDDEN_KEY_PATTERN.test(key) && typeof value === 'boolean'
      )),
    )
    : null;

  const recommendedCommandCount = Array.isArray(validation.recommendedCommands)
    ? validation.recommendedCommands.length
    : 0;

  const cache = isPlainObject(payload.cache) ? payload.cache : null;
  const cacheLabel = formatCacheFreshness(cache, nowMs);
  const generatedAt = typeof payload.generatedAt === 'string' ? payload.generatedAt : null;

  const { tone, label } = describeDbReadinessStatus(status);

  return {
    status,
    tone,
    label,
    summaryLine: `DB readiness: ${status} — ${failureCount} fail / ${warningCount} warn`,
    reminder: readinessReminderForStatus(status),
    cacheLabel,
    generatedAt,
    failureCount,
    warningCount,
    totalChecks,
    recommendedCommandCount,
    flags,
    failingChecks: checks.filter((c) => c && c.status === 'fail'),
    warningChecks: checks.filter((c) => c && c.status === 'warn'),
  };
}
