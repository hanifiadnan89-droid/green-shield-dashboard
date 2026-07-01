import { createAIUsageRepository } from '../currentStores/aiUsageJsonRepository.js';
import { createErrorLogRepository } from '../currentStores/errorLogJsonRepository.js';
import { createAIUsagePostgresRepository } from '../postgres/aiUsagePostgresRepository.js';
import { createErrorLogPostgresRepository } from '../postgres/errorLogPostgresRepository.js';

const DEFAULT_LIMIT = 500;
const DEFAULT_BATCH_SIZE = 100;
const MAX_ERROR_COUNT = 25;

function safeLimit(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 5000) : DEFAULT_LIMIT;
}

function safeBatchSize(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : DEFAULT_BATCH_SIZE;
}

function safeError(error, id = null) {
  return {
    id,
    code: error?.code || 'BACKFILL_WRITE_FAILED',
    message: error?.message || 'Backfill write failed.',
  };
}

function makeSummary(domain, { read = 0, attempted = 0, written = 0, failed = 0, skipped = 0, dryRun = true, errors = [] } = {}) {
  return {
    domain,
    read,
    attempted,
    written,
    failed,
    skipped,
    dryRun,
    errors: errors.slice(0, MAX_ERROR_COUNT),
  };
}

function chunk(entries, size) {
  const chunks = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size));
  }
  return chunks;
}

async function writeEntries({
  domain,
  entries,
  writeEntry,
  dryRun,
  strict,
  batchSize,
}) {
  const summary = makeSummary(domain, {
    read: entries.length,
    attempted: dryRun ? 0 : entries.length,
    skipped: dryRun ? entries.length : 0,
    dryRun,
  });

  if (dryRun) return summary;

  for (const batch of chunk(entries, batchSize)) {
    for (const entry of batch) {
      try {
        await writeEntry(entry);
        summary.written += 1;
      } catch (err) {
        summary.failed += 1;
        summary.errors.push(safeError(err, entry?.id || null));
        if (strict) {
          const strictError = new Error(`${domain} backfill failed.`);
          strictError.code = 'APPEND_ONLY_BACKFILL_FAILED';
          strictError.summary = summary;
          throw strictError;
        }
      }
    }
  }

  summary.errors = summary.errors.slice(0, MAX_ERROR_COUNT);
  return summary;
}

export async function backfillAIUsageLogs(options = {}) {
  const currentRepository = options.currentAIUsageRepository || options.currentRepository || createAIUsageRepository();
  const postgresRepository = options.postgresAIUsageRepository || options.postgresRepository || createAIUsagePostgresRepository();
  const limit = safeLimit(options.limit);
  const entries = await currentRepository.listUsage({ limit });
  return writeEntries({
    domain: 'ai_usage',
    entries,
    writeEntry: (entry) => postgresRepository.recordUsage(entry),
    dryRun: options.dryRun !== false,
    strict: options.strict === true,
    batchSize: safeBatchSize(options.batchSize),
  });
}

export async function backfillErrorLogs(options = {}) {
  const currentRepository = options.currentErrorLogRepository || options.currentRepository || createErrorLogRepository();
  const postgresRepository = options.postgresErrorLogRepository || options.postgresRepository || createErrorLogPostgresRepository();
  const limit = safeLimit(options.limit);
  const result = await currentRepository.listErrors({ limit, includeArchived: true });
  const entries = Array.isArray(result) ? result : (result?.errors || []);
  return writeEntries({
    domain: 'error_log',
    entries,
    writeEntry: (entry) => postgresRepository.createError(entry),
    dryRun: options.dryRun !== false,
    strict: options.strict === true,
    batchSize: safeBatchSize(options.batchSize),
  });
}

export async function backfillAppendOnlyLogs(options = {}) {
  const domain = options.domain || 'all';
  const summaries = [];
  if (domain === 'all' || domain === 'ai_usage') {
    summaries.push(await backfillAIUsageLogs(options));
  }
  if (domain === 'all' || domain === 'error_log') {
    summaries.push(await backfillErrorLogs(options));
  }
  return {
    dryRun: options.dryRun !== false,
    domain,
    summaries,
  };
}

export { safeLimit, safeBatchSize };

