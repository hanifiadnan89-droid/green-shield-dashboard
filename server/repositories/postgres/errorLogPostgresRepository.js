import { getSafeDatabaseConfig } from '../../services/db/dbConfig.js';
import { query as defaultQuery } from '../../services/db/dbClient.js';
import { assertErrorLogRepository } from '../contracts/ErrorLogRepository.js';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

function normalizeTimestamp(value) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function safeJson(value) {
  if (value == null) return null;
  if (typeof value !== 'object') return null;
  return JSON.stringify(value);
}

function normalizeErrorRecord(record = {}) {
  return {
    id: nonEmptyString(record.id),
    organizationId: nonEmptyString(record.organizationId),
    timestamp: normalizeTimestamp(record.timestamp || record.createdAt),
    severity: nonEmptyString(record.severity) || 'info',
    status: nonEmptyString(record.status) || 'new',
    source: nonEmptyString(record.source),
    page: nonEmptyString(record.page),
    module: nonEmptyString(record.module),
    endpoint: nonEmptyString(record.endpoint),
    httpStatus: record.httpStatus == null ? null : safeInteger(record.httpStatus, null),
    errorCode: nonEmptyString(record.errorCode),
    message: nonEmptyString(record.message) || 'Unknown error',
    stackTrace: nonEmptyString(record.stackTrace),
    userFacingMessage: nonEmptyString(record.userFacingMessage),
    technicalDetails: typeof record.technicalDetails === 'string'
      ? record.technicalDetails
      : nonEmptyString(record.technicalDetails == null ? null : JSON.stringify(record.technicalDetails)),
    requestId: nonEmptyString(record.requestId),
    relatedLeadId: nonEmptyString(record.relatedLeadId || record.relatedLead?.id || record.relatedLead?.leadId),
    relatedCustomerId: nonEmptyString(record.relatedCustomerId || record.relatedCustomer?.id),
    suggestedFix: nonEmptyString(record.suggestedFix),
    likelyCause: nonEmptyString(record.likelyCause),
    rawMetadata: safeJson(record.rawMetadata),
    deployment: safeJson(record.deployment),
    timeline: safeJson(record.timeline),
    aiAnalysis: safeJson(record.aiAnalysis),
    firstSeenAt: record.firstSeenAt ? normalizeTimestamp(record.firstSeenAt) : null,
    lastSeenAt: record.lastSeenAt ? normalizeTimestamp(record.lastSeenAt) : null,
    occurrenceCount: safeInteger(record.occurrenceCount, 1) || 1,
    archived: record.archived === true || record.status === 'archived',
    dedupKey: nonEmptyString(record.dedupKey),
    createdAt: normalizeTimestamp(record.createdAt || record.timestamp),
    updatedAt: normalizeTimestamp(record.updatedAt || record.createdAt || record.timestamp),
  };
}

function mapErrorRow(row = {}) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    severity: row.severity,
    status: row.status,
    source: row.source,
    page: row.page,
    module: row.module,
    endpoint: row.endpoint,
    httpStatus: row.http_status,
    errorCode: row.error_code,
    message: row.message,
    stackTrace: row.stack_trace,
    userFacingMessage: row.user_facing_message,
    technicalDetails: row.technical_details,
    requestId: row.request_id,
    relatedLeadId: row.related_lead_id,
    relatedCustomerId: row.related_customer_id,
    suggestedFix: row.suggested_fix,
    likelyCause: row.likely_cause,
    rawMetadata: row.raw_metadata || null,
    deployment: row.deployment || null,
    timeline: row.timeline || null,
    aiAnalysis: row.ai_analysis || null,
    firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : row.first_seen_at,
    lastSeenAt: row.last_seen_at instanceof Date ? row.last_seen_at.toISOString() : row.last_seen_at,
    occurrenceCount: row.occurrence_count,
    archived: row.archived,
    dedupKey: row.dedup_key,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function buildFilters(filters = {}) {
  const clauses = [];
  const values = [];
  for (const [field, column] of [
    ['severity', 'severity'],
    ['status', 'status'],
    ['source', 'source'],
    ['module', 'module'],
  ]) {
    if (filters[field]) {
      values.push(String(filters[field]));
      clauses.push(`${column} = $${values.length}`);
    }
  }
  if (!filters.includeArchived) {
    clauses.push('archived = false');
  }
  if (filters.query) {
    values.push(`%${String(filters.query)}%`);
    clauses.push(`(message ilike $${values.length} or error_code ilike $${values.length} or endpoint ilike $${values.length})`);
  }
  return {
    where: clauses.length ? `where ${clauses.join(' and ')}` : '',
    values,
  };
}

export function createErrorLogPostgresRepository({ query = defaultQuery, env = process.env } = {}) {
  return assertErrorLogRepository({
    async createError(input) {
      const record = normalizeErrorRecord(input);
      if (!record.id) {
        const err = new Error('Error id is required for Postgres persistence.');
        err.code = 'ERROR_LOG_ID_REQUIRED';
        throw err;
      }
      await query(
        `insert into error_log (
          id, organization_id, timestamp, severity, status, source, page, module, endpoint,
          http_status, error_code, message, stack_trace, user_facing_message, technical_details,
          request_id, related_lead_id, related_customer_id, suggested_fix, likely_cause,
          raw_metadata, deployment, timeline, ai_analysis, first_seen_at, last_seen_at,
          occurrence_count, archived, dedup_key, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21::jsonb, $22::jsonb, $23::jsonb, $24::jsonb, $25, $26,
          $27, $28, $29, $30, $31
        )
        on conflict (id) do update set
          status = excluded.status,
          last_seen_at = excluded.last_seen_at,
          occurrence_count = excluded.occurrence_count,
          archived = excluded.archived,
          timeline = excluded.timeline,
          ai_analysis = excluded.ai_analysis,
          updated_at = excluded.updated_at`,
        [
          record.id,
          record.organizationId,
          record.timestamp,
          record.severity,
          record.status,
          record.source,
          record.page,
          record.module,
          record.endpoint,
          record.httpStatus,
          record.errorCode,
          record.message,
          record.stackTrace,
          record.userFacingMessage,
          record.technicalDetails,
          record.requestId,
          record.relatedLeadId,
          record.relatedCustomerId,
          record.suggestedFix,
          record.likelyCause,
          record.rawMetadata,
          record.deployment,
          record.timeline,
          record.aiAnalysis,
          record.firstSeenAt,
          record.lastSeenAt,
          record.occurrenceCount,
          record.archived,
          record.dedupKey,
          record.createdAt,
          record.updatedAt,
        ],
        { env },
      );
      return input;
    },

    async listErrors(filters = {}) {
      const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
      const offset = Math.max(Number(filters.offset) || 0, 0);
      const { where, values } = buildFilters(filters);
      values.push(limit, offset);
      const result = await query(
        `select *
         from error_log
         ${where}
         order by created_at desc
         limit $${values.length - 1}
         offset $${values.length}`,
        values,
        { env },
      );
      return {
        errors: (result.rows || []).map(mapErrorRow),
        total: (result.rows || []).length,
      };
    },

    async getErrorById(id) {
      const result = await query('select * from error_log where id = $1 limit 1', [id], { env });
      return result.rows?.[0] ? mapErrorRow(result.rows[0]) : null;
    },

    async updateErrorStatus(id, status) {
      const result = await query(
        `update error_log
         set status = $2, archived = ($2 = 'archived'), updated_at = now()
         where id = $1
         returning *`,
        [id, status],
        { env },
      );
      return result.rows?.[0] ? mapErrorRow(result.rows[0]) : null;
    },

    markResolved(id, options) {
      return this.updateErrorStatus(id, 'resolved', options);
    },

    archive(id, options) {
      return this.updateErrorStatus(id, 'archived', options);
    },

    async summarizeErrors() {
      const result = await query(
        `select
          count(*)::int as total,
          count(*) filter (where severity = 'critical')::int as critical,
          count(*) filter (where status not in ('resolved', 'ignored'))::int as unresolved
         from error_log
         where archived = false`,
        [],
        { env },
      );
      return result.rows?.[0] || { total: 0, critical: 0, unresolved: 0 };
    },

    async findSimilarErrors() {
      return [];
    },

    async setErrorAnalysis(id, analysis) {
      const result = await query(
        `update error_log
         set ai_analysis = $2::jsonb, updated_at = now()
         where id = $1
         returning *`,
        [id, safeJson(analysis)],
        { env },
      );
      return result.rows?.[0] ? mapErrorRow(result.rows[0]) : null;
    },

    getStorageStatus() {
      return {
        backend: 'postgres',
        ...getSafeDatabaseConfig(env),
      };
    },
  });
}

export { normalizeErrorRecord };

