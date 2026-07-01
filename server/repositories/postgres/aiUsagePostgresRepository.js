import { getSafeDatabaseConfig } from '../../services/db/dbConfig.js';
import { query as defaultQuery } from '../../services/db/dbClient.js';
import { assertAIUsageRepository } from '../contracts/AIUsageRepository.js';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function normalizeTimestamp(value) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function safeJson(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return JSON.stringify(value);
}

function normalizeUsageEntry(entry = {}) {
  const success = entry.success === true;
  return {
    id: nonEmptyString(entry.id),
    organizationId: nonEmptyString(entry.organizationId),
    userId: nonEmptyString(entry.userId),
    timestamp: normalizeTimestamp(entry.timestamp),
    endpoint: nonEmptyString(entry.endpoint),
    feature: nonEmptyString(entry.feature),
    provider: nonEmptyString(entry.provider) || 'unknown',
    model: nonEmptyString(entry.model),
    durationMs: safeInteger(entry.durationMs),
    inputSize: safeInteger(entry.inputSize),
    outputSize: safeInteger(entry.outputSize),
    success,
    status: nonEmptyString(entry.status) || (success ? 'success' : 'failure'),
    errorCode: success ? null : nonEmptyString(entry.errorCode),
    requestId: nonEmptyString(entry.requestId),
    source: nonEmptyString(entry.source),
    metadata: safeJson(entry.metadata),
  };
}

function buildFilters(filters = {}) {
  const clauses = [];
  const values = [];

  for (const [field, column] of [
    ['feature', 'feature'],
    ['provider', 'provider'],
    ['model', 'model'],
    ['endpoint', 'endpoint'],
  ]) {
    if (filters[field]) {
      values.push(String(filters[field]));
      clauses.push(`${column} = $${values.length}`);
    }
  }

  if (filters.success != null) {
    values.push(filters.success === true || filters.success === 'true');
    clauses.push(`success = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    clauses.push(`timestamp >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    clauses.push(`timestamp <= $${values.length}`);
  }

  return {
    where: clauses.length ? `where ${clauses.join(' and ')}` : '',
    values,
  };
}

function mapUsageRow(row = {}) {
  return {
    id: row.id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    endpoint: row.endpoint,
    feature: row.feature,
    provider: row.provider,
    model: row.model,
    durationMs: row.duration_ms,
    inputSize: row.input_size,
    outputSize: row.output_size,
    success: row.success,
    errorCode: row.error_code,
    status: row.status,
    requestId: row.request_id,
    organizationId: row.organization_id,
    userId: row.user_id,
    source: row.source,
    metadata: row.metadata || null,
  };
}

export function createAIUsagePostgresRepository({ query = defaultQuery, env = process.env } = {}) {
  return assertAIUsageRepository({
    async recordUsage(entry) {
      const normalized = normalizeUsageEntry(entry);
      if (!normalized.id) {
        const err = new Error('AI usage id is required for Postgres persistence.');
        err.code = 'AI_USAGE_ID_REQUIRED';
        throw err;
      }

      await query(
        `insert into ai_usage_logs (
          id, organization_id, user_id, timestamp, endpoint, feature, provider, model,
          duration_ms, input_size, output_size, success, status, error_code, request_id,
          source, metadata
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17::jsonb
        )
        on conflict (id) do nothing`,
        [
          normalized.id,
          normalized.organizationId,
          normalized.userId,
          normalized.timestamp,
          normalized.endpoint,
          normalized.feature,
          normalized.provider,
          normalized.model,
          normalized.durationMs,
          normalized.inputSize,
          normalized.outputSize,
          normalized.success,
          normalized.status,
          normalized.errorCode,
          normalized.requestId,
          normalized.source,
          normalized.metadata,
        ],
        { env },
      );

      return entry;
    },

    async listUsage(filters = {}) {
      const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
      const { where, values } = buildFilters(filters);
      values.push(limit);
      const result = await query(
        `select *
         from ai_usage_logs
         ${where}
         order by timestamp desc
         limit $${values.length}`,
        values,
        { env },
      );
      return (result.rows || []).map(mapUsageRow);
    },

    async summarizeUsage(filters = {}) {
      const entries = await this.listUsage({ ...filters, limit: 500 });
      const summary = {
        total: entries.length,
        success: 0,
        failure: 0,
        averageDurationMs: 0,
        byFeature: {},
        byProvider: {},
        byErrorCode: {},
      };
      let totalDuration = 0;
      for (const entry of entries) {
        if (entry.success) summary.success += 1;
        else summary.failure += 1;
        if (entry.feature) summary.byFeature[entry.feature] = (summary.byFeature[entry.feature] || 0) + 1;
        if (entry.provider) summary.byProvider[entry.provider] = (summary.byProvider[entry.provider] || 0) + 1;
        if (!entry.success && entry.errorCode) {
          summary.byErrorCode[entry.errorCode] = (summary.byErrorCode[entry.errorCode] || 0) + 1;
        }
        totalDuration += safeInteger(entry.durationMs);
      }
      summary.averageDurationMs = entries.length ? Math.round(totalDuration / entries.length) : 0;
      return summary;
    },

    getStorageStatus() {
      return {
        backend: 'postgres',
        ...getSafeDatabaseConfig(env),
      };
    },
  });
}

export { normalizeUsageEntry };

