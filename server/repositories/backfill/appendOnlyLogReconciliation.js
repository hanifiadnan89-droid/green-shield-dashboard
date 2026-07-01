import { createAIUsageRepository } from '../currentStores/aiUsageJsonRepository.js';
import { createErrorLogRepository } from '../currentStores/errorLogJsonRepository.js';
import { createAIUsagePostgresRepository } from '../postgres/aiUsagePostgresRepository.js';
import { createErrorLogPostgresRepository } from '../postgres/errorLogPostgresRepository.js';

const DEFAULT_LIMIT = 500;
const MAX_ID_DIFFS = 50;

function safeLimit(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 5000) : DEFAULT_LIMIT;
}

function normalizeIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function latestTimestamp(entries) {
  let latest = null;
  for (const entry of entries) {
    const value = normalizeIso(entry.timestamp || entry.createdAt || entry.updatedAt);
    if (value && (!latest || value > latest)) latest = value;
  }
  return latest;
}

function countBy(entries, selector) {
  const counts = {};
  for (const entry of entries) {
    const key = selector(entry);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function sameCounts(a, b) {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, index) => key === bKeys[index] && a[key] === b[key]);
}

function idSet(entries) {
  return new Set(entries.map((entry) => entry.id).filter(Boolean));
}

function diffIds(left, right) {
  const missing = [];
  for (const id of left) {
    if (!right.has(id)) missing.push(id);
    if (missing.length >= MAX_ID_DIFFS) break;
  }
  return missing;
}

function compareEntries({ domain, currentEntries, postgresEntries, bucketChecks }) {
  const currentIds = idSet(currentEntries);
  const postgresIds = idSet(postgresEntries);
  const missingIds = diffIds(currentIds, postgresIds);
  const extraIds = diffIds(postgresIds, currentIds);
  const currentLatest = latestTimestamp(currentEntries);
  const postgresLatest = latestTimestamp(postgresEntries);
  const checks = {
    totalCount: currentEntries.length === postgresEntries.length,
    latestTimestamp: currentLatest === postgresLatest,
    ids: missingIds.length === 0 && extraIds.length === 0,
  };
  for (const [name, selector] of Object.entries(bucketChecks)) {
    checks[name] = sameCounts(countBy(currentEntries, selector), countBy(postgresEntries, selector));
  }
  const matched = Object.values(checks).every(Boolean);
  return {
    domain,
    currentCount: currentEntries.length,
    postgresCount: postgresEntries.length,
    matched,
    missingIds,
    extraIds,
    latestTimestamp: {
      current: currentLatest,
      postgres: postgresLatest,
    },
    checks,
  };
}

export async function reconcileAIUsageLogs(options = {}) {
  const currentRepository = options.currentAIUsageRepository || options.currentRepository || createAIUsageRepository();
  const postgresRepository = options.postgresAIUsageRepository || options.postgresRepository || createAIUsagePostgresRepository();
  const limit = safeLimit(options.limit);
  const currentEntries = await currentRepository.listUsage({ limit });
  const postgresEntries = await postgresRepository.listUsage({ limit });
  return compareEntries({
    domain: 'ai_usage',
    currentEntries,
    postgresEntries,
    bucketChecks: {
      byProvider: (entry) => entry.provider,
      byFeature: (entry) => entry.feature,
      bySuccess: (entry) => String(Boolean(entry.success)),
    },
  });
}

export async function reconcileErrorLogs(options = {}) {
  const currentRepository = options.currentErrorLogRepository || options.currentRepository || createErrorLogRepository();
  const postgresRepository = options.postgresErrorLogRepository || options.postgresRepository || createErrorLogPostgresRepository();
  const limit = safeLimit(options.limit);
  const currentResult = await currentRepository.listErrors({ limit, includeArchived: true });
  const postgresResult = await postgresRepository.listErrors({ limit, includeArchived: true });
  const currentEntries = Array.isArray(currentResult) ? currentResult : (currentResult?.errors || []);
  const postgresEntries = Array.isArray(postgresResult) ? postgresResult : (postgresResult?.errors || []);
  return compareEntries({
    domain: 'error_log',
    currentEntries,
    postgresEntries,
    bucketChecks: {
      bySeverity: (entry) => entry.severity,
      byStatus: (entry) => entry.status,
    },
  });
}

export async function reconcileAppendOnlyLogs(options = {}) {
  const domain = options.domain || 'all';
  const results = [];
  if (domain === 'all' || domain === 'ai_usage') {
    results.push(await reconcileAIUsageLogs(options));
  }
  if (domain === 'all' || domain === 'error_log') {
    results.push(await reconcileErrorLogs(options));
  }
  return {
    domain,
    matched: results.every((result) => result.matched),
    results,
  };
}

export { compareEntries, MAX_ID_DIFFS };

