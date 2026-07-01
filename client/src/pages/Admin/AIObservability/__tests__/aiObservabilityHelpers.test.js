import { describe, expect, it } from 'vitest';
import {
  breakdownToRows,
  buildUsageQueryParams,
  computeSuccessRate,
  countDeprecatedRouteHits,
  describeDbReadinessStatus,
  describeHealthStatus,
  ENTRY_DISPLAY_FIELDS,
  formatCacheFreshness,
  formatDurationMs,
  formatSize,
  formatSuccessRate,
  formatTimestamp,
  isAdminAuthStatus,
  pickMostCommon,
  READINESS_SAFE_FLAG_NAMES,
  readinessReminderForStatus,
  SAFE_METADATA_FIELDS,
  SAFE_STORAGE_FIELDS,
  sanitizeEntriesForDisplay,
  sanitizeEntryForDisplay,
  sanitizeValidationCheckForDisplay,
  sanitizeValidationChecksForDisplay,
  summarizeDbReadiness,
  summarizeStorageStatus,
} from '../aiObservabilityHelpers.js';

describe('sanitizeEntryForDisplay', () => {
  it('keeps only the documented allow-listed fields', () => {
    const entry = {
      id: 'ai_usage_1',
      timestamp: '2026-06-29T12:00:00.000Z',
      endpoint: '/api/ai/assist-reply',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku',
      durationMs: 412,
      inputSize: 1234,
      outputSize: 56,
      success: true,
      errorCode: null,
      status: 'success',
      requestId: 'req-abc',
    };
    expect(sanitizeEntryForDisplay(entry)).toEqual(entry);
  });

  it('strips forbidden raw-content fields even if a regression leaks them', () => {
    const leaky = {
      id: 'ai_usage_2',
      timestamp: '2026-06-29T12:00:00.000Z',
      feature: 'assist-reply',
      provider: 'anthropic',
      model: 'claude-haiku',
      durationMs: 100,
      inputSize: 50,
      outputSize: 20,
      success: true,
      status: 'success',
      // forbidden:
      prompt: 'SECRET PROMPT',
      messages: [{ role: 'user', content: 'CUSTOMER MESSAGE' }],
      system: 'SYSTEM PROMPT',
      text: 'RAW MODEL OUTPUT',
      raw: { content: [{ text: 'do not show' }] },
      response: { data: 'do not show' },
      data: [{ embedding: [0.1, 0.2] }],
      embedding: [0.42, 0.99],
      embeddings: [[0.1]],
      transcript: 'TRANSCRIPT BODY 207-555-0100',
      segments: [{ text: 'segment leak' }],
      apiKey: 'sk-abc123',
      Authorization: 'Bearer secret-token',
      cookie: 'session=foo',
    };
    const sanitized = sanitizeEntryForDisplay(leaky);
    expect(sanitized).not.toHaveProperty('prompt');
    expect(sanitized).not.toHaveProperty('messages');
    expect(sanitized).not.toHaveProperty('system');
    expect(sanitized).not.toHaveProperty('text');
    expect(sanitized).not.toHaveProperty('raw');
    expect(sanitized).not.toHaveProperty('response');
    expect(sanitized).not.toHaveProperty('data');
    expect(sanitized).not.toHaveProperty('embedding');
    expect(sanitized).not.toHaveProperty('embeddings');
    expect(sanitized).not.toHaveProperty('transcript');
    expect(sanitized).not.toHaveProperty('segments');
    expect(sanitized).not.toHaveProperty('apiKey');
    expect(sanitized).not.toHaveProperty('Authorization');
    expect(sanitized).not.toHaveProperty('cookie');

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('SECRET PROMPT');
    expect(serialized).not.toContain('CUSTOMER MESSAGE');
    expect(serialized).not.toContain('RAW MODEL OUTPUT');
    expect(serialized).not.toContain('TRANSCRIPT BODY');
    expect(serialized).not.toContain('207-555-0100');
    expect(serialized).not.toContain('sk-abc123');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('0.42');
    expect(serialized).not.toContain('0.99');
  });

  it('passes through only safe metadata keys', () => {
    const sanitized = sanitizeEntryForDisplay({
      id: 'x',
      feature: 'embeddings',
      metadata: {
        inputCount: 3,
        fileSizeBytes: 1024,
        extension: 'mp3',
        deprecatedRoute: true,
        deprecatedPath: '/api/ai/draft-reply',
        replacementPath: '/api/ai/assist-reply',
        embedding: [0.1, 0.2],
        prompt: 'SECRET',
        apiKey: 'sk-abc',
      },
    });
    expect(sanitized.metadata).toEqual({
      inputCount: 3,
      fileSizeBytes: 1024,
      extension: 'mp3',
      deprecatedRoute: true,
      deprecatedPath: '/api/ai/draft-reply',
      replacementPath: '/api/ai/assist-reply',
    });
  });

  it('counts deprecated route hits from sanitized metadata only', () => {
    expect(countDeprecatedRouteHits([
      { metadata: { deprecatedRoute: true } },
      { metadata: { deprecatedRoute: false } },
      { metadata: { deprecatedPath: '/api/ai/draft-reply' } },
      null,
    ])).toBe(1);
  });

  it('returns null for non-objects', () => {
    expect(sanitizeEntryForDisplay(null)).toBeNull();
    expect(sanitizeEntryForDisplay(undefined)).toBeNull();
    expect(sanitizeEntryForDisplay(42)).toBeNull();
  });

  it('sanitizeEntriesForDisplay returns empty array for non-arrays', () => {
    expect(sanitizeEntriesForDisplay(null)).toEqual([]);
    expect(sanitizeEntriesForDisplay('not-an-array')).toEqual([]);
  });

  it('display field list matches the documented spec', () => {
    expect(ENTRY_DISPLAY_FIELDS).toEqual([
      'id', 'timestamp', 'endpoint', 'feature', 'provider', 'model',
      'durationMs', 'inputSize', 'outputSize', 'success', 'errorCode',
      'status', 'requestId',
    ]);
    expect(SAFE_METADATA_FIELDS).toEqual([
      'inputCount',
      'fileSizeBytes',
      'extension',
      'deprecatedRoute',
      'deprecatedPath',
      'replacementPath',
    ]);
  });
});

describe('summary helpers', () => {
  it('computeSuccessRate handles edge cases', () => {
    expect(computeSuccessRate(null)).toBeNull();
    expect(computeSuccessRate({ total: 0, success: 0 })).toBeNull();
    expect(computeSuccessRate({ total: 10, success: 7 })).toBeCloseTo(0.7);
  });

  it('formatSuccessRate', () => {
    expect(formatSuccessRate(0.823)).toBe('82.3%');
    expect(formatSuccessRate(null)).toBe('—');
  });

  it('formatDurationMs', () => {
    expect(formatDurationMs(0)).toBe('0 ms');
    expect(formatDurationMs(950)).toBe('950 ms');
    expect(formatDurationMs(1250)).toBe('1.25 s');
    expect(formatDurationMs(null)).toBe('—');
    expect(formatDurationMs(-1)).toBe('—');
  });

  it('formatSize', () => {
    expect(formatSize(500)).toBe('500');
    expect(formatSize(2048)).toBe('2.0 KB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.00 MB');
    expect(formatSize(null)).toBe('—');
  });

  it('formatTimestamp', () => {
    const formatted = formatTimestamp('2026-06-29T12:34:56.000Z');
    expect(formatted).toMatch(/^2026-06-(28|29|30) /);
    expect(formatTimestamp(null)).toBe('—');
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
  });

  it('pickMostCommon picks the highest count', () => {
    expect(pickMostCommon({ a: 1, b: 4, c: 2 })).toEqual({ key: 'b', count: 4 });
    expect(pickMostCommon({})).toBeNull();
    expect(pickMostCommon(null)).toBeNull();
  });

  it('breakdownToRows sorts descending by count then alpha', () => {
    expect(breakdownToRows({ a: 1, b: 4, c: 4 })).toEqual([
      { key: 'b', count: 4 },
      { key: 'c', count: 4 },
      { key: 'a', count: 1 },
    ]);
    expect(breakdownToRows(null)).toEqual([]);
  });

  it('describeHealthStatus maps known statuses', () => {
    expect(describeHealthStatus('healthy').tone).toBe('success');
    expect(describeHealthStatus('degraded').tone).toBe('warn');
    expect(describeHealthStatus('unconfigured').tone).toBe('danger');
    expect(describeHealthStatus('mystery').tone).toBe('neutral');
  });
});

describe('summarizeStorageStatus', () => {
  it('exposes only the documented safe fields', () => {
    expect(SAFE_STORAGE_FIELDS).toEqual([
      'backend', 'configured', 'source', 'render', 'production', 'inRepo', 'writeSafe', 'warning',
    ]);
  });

  it('returns success tone for a healthy persistent_disk configuration', () => {
    const out = summarizeStorageStatus({
      backend: 'persistent_disk', configured: true, source: 'AI_USAGE_LOG_DATA_DIR',
      render: true, production: true, inRepo: false, writeSafe: true, warning: null,
    });
    expect(out.tone).toBe('success');
    expect(out.writeSafe).toBe(true);
  });

  it('returns warn tone for a write-safe but in-repo local dev configuration', () => {
    const out = summarizeStorageStatus({
      backend: 'file', configured: false, source: 'default',
      render: false, production: false, inRepo: true, writeSafe: true,
      warning: 'AI usage log is using local development storage inside the application repository.',
    });
    expect(out.tone).toBe('warn');
  });

  it('returns danger tone when writeSafe is false', () => {
    const out = summarizeStorageStatus({
      backend: 'file', configured: false, source: 'default',
      render: true, production: true, inRepo: true, writeSafe: false,
      warning: 'AI usage log production writes are disabled.',
    });
    expect(out.tone).toBe('danger');
  });

  it('strips unexpected/forbidden fields even if a regression leaks them', () => {
    const out = summarizeStorageStatus({
      backend: 'persistent_disk',
      configured: true,
      source: 'AI_USAGE_LOG_DATA_DIR',
      render: true,
      production: true,
      inRepo: false,
      writeSafe: true,
      warning: null,
      filePath: '/var/data/leak/ai-usage-log.json',
      dataDir: '/var/data/leak',
      renderConfigValid: true,
      apiKey: 'sk-leaked',
      Authorization: 'Bearer leak',
    });
    expect(out).not.toHaveProperty('filePath');
    expect(out).not.toHaveProperty('dataDir');
    expect(out).not.toHaveProperty('renderConfigValid');
    expect(out).not.toHaveProperty('apiKey');
    expect(out).not.toHaveProperty('Authorization');
    const serialized = JSON.stringify(out);
    expect(serialized).not.toMatch(/\/var\/data/);
    expect(serialized).not.toContain('sk-leaked');
    expect(serialized).not.toContain('Bearer');
  });

  it('returns null for non-objects', () => {
    expect(summarizeStorageStatus(null)).toBeNull();
    expect(summarizeStorageStatus(undefined)).toBeNull();
    expect(summarizeStorageStatus('healthy')).toBeNull();
  });
});

describe('isAdminAuthStatus', () => {
  it('returns true for an active authenticated admin (isAdmin flag)', () => {
    expect(isAdminAuthStatus({
      authenticated: true,
      currentUser: { isAdmin: true, status: 'active', role: 'admin' },
    })).toBe(true);
  });

  it('returns true when role is admin even if isAdmin flag is missing', () => {
    expect(isAdminAuthStatus({
      authenticated: true,
      currentUser: { role: 'admin', status: 'active' },
    })).toBe(true);
  });

  it('returns false when currentUser is not admin', () => {
    expect(isAdminAuthStatus({
      authenticated: true,
      currentUser: { isAdmin: false, status: 'active', role: 'sales_rep' },
    })).toBe(false);
    expect(isAdminAuthStatus({
      authenticated: true,
      currentUser: { isAdmin: false, status: 'active', role: 'manager' },
    })).toBe(false);
  });

  it('returns false when authenticated is false', () => {
    expect(isAdminAuthStatus({
      authenticated: false,
      currentUser: { isAdmin: true, role: 'admin', status: 'active' },
    })).toBe(false);
  });

  it('returns false when admin account is inactive', () => {
    expect(isAdminAuthStatus({
      authenticated: true,
      currentUser: { isAdmin: true, role: 'admin', status: 'inactive' },
    })).toBe(false);
  });

  it('returns false for missing or malformed payloads', () => {
    expect(isAdminAuthStatus(null)).toBe(false);
    expect(isAdminAuthStatus(undefined)).toBe(false);
    expect(isAdminAuthStatus({})).toBe(false);
    expect(isAdminAuthStatus({ authenticated: true })).toBe(false);
    expect(isAdminAuthStatus({ authenticated: true, currentUser: null })).toBe(false);
    expect(isAdminAuthStatus('admin')).toBe(false);
  });
});

describe('buildUsageQueryParams', () => {
  it('only forwards filled filters and normalizes success', () => {
    expect(buildUsageQueryParams({ feature: 'embeddings', provider: '', limit: '50', success: 'false' }))
      .toEqual({ feature: 'embeddings', limit: 50, success: false });
    expect(buildUsageQueryParams({})).toEqual({});
    expect(buildUsageQueryParams({ success: true })).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// Stage 39 — append-only DB readiness banner helpers
// ---------------------------------------------------------------------------

const SAMPLE_PASS_PAYLOAD = {
  source: 'append_only_db_enablement_validation',
  generatedAt: '2026-06-30T12:00:00.000Z',
  cache: { cached: false, cacheTtlSeconds: 30, cachedAt: '2026-06-30T12:00:00.000Z' },
  validation: {
    status: 'pass',
    checks: [
      { name: 'database_configured', status: 'pass', message: 'ok', details: { configured: true, redactedDatabaseUrl: 'postgres://***:***@db.example.invalid:5432/staging' } },
      { name: 'feature_flags', status: 'pass', message: 'safe', details: { flags: { dbWriteAIUsageEnabled: false, dbReadAIUsageEnabled: false, dbWriteErrorLogEnabled: false, dbReadErrorLogEnabled: false } } },
    ],
    recommendedCommands: ['npm run db:validate:append-only --prefix server'],
  },
};

describe('describeDbReadinessStatus', () => {
  it('maps known statuses to a label + tone', () => {
    expect(describeDbReadinessStatus('pass')).toEqual({ label: 'Pass', tone: 'success' });
    expect(describeDbReadinessStatus('warn')).toEqual({ label: 'Warn', tone: 'warn' });
    expect(describeDbReadinessStatus('fail')).toEqual({ label: 'Fail', tone: 'danger' });
    expect(describeDbReadinessStatus('loading')).toEqual({ label: 'Loading', tone: 'neutral' });
    expect(describeDbReadinessStatus('error')).toEqual({ label: 'Error', tone: 'danger' });
  });
  it('falls back to Unknown/neutral for unrecognized statuses', () => {
    expect(describeDbReadinessStatus(null)).toEqual({ label: 'Unknown', tone: 'neutral' });
    expect(describeDbReadinessStatus('mystery')).toEqual({ label: 'Unknown', tone: 'neutral' });
  });
});

describe('readinessReminderForStatus', () => {
  it('returns the expected operator-facing reminder per status', () => {
    expect(readinessReminderForStatus('pass')).toMatch(/manual approval/i);
    expect(readinessReminderForStatus('warn')).toMatch(/do not enable production write flags/i);
    expect(readinessReminderForStatus('fail')).toMatch(/Do not enable DB write flags/i);
  });
  it('returns an empty string for unknown statuses', () => {
    expect(readinessReminderForStatus('unknown')).toBe('');
    expect(readinessReminderForStatus(undefined)).toBe('');
  });
});

describe('formatCacheFreshness', () => {
  it('returns a fresh-result label when the cache reports not-cached', () => {
    expect(formatCacheFreshness({ cached: false, cacheTtlSeconds: 30 })).toBe('Fresh result, cache TTL 30s');
    expect(formatCacheFreshness({ cached: false })).toBe('Fresh result');
  });
  it('returns a cached-result label with a seconds-ago counter', () => {
    const cachedAt = '2026-06-30T12:00:00.000Z';
    const nowMs = new Date('2026-06-30T12:00:18.000Z').getTime();
    expect(formatCacheFreshness({ cached: true, cacheTtlSeconds: 30, cachedAt }, nowMs)).toBe('Cached result, refreshed 18s ago');
  });
  it('returns a fallback for cached without a parseable cachedAt', () => {
    expect(formatCacheFreshness({ cached: true })).toBe('Cached result');
    expect(formatCacheFreshness({ cached: true, cachedAt: 'not-a-date' })).toBe('Cached result');
  });
  it('returns null for non-object input', () => {
    expect(formatCacheFreshness(null)).toBeNull();
    expect(formatCacheFreshness('cached')).toBeNull();
  });
});

describe('sanitizeValidationCheckForDisplay', () => {
  it('keeps name, status, message and only renderable safe details', () => {
    const out = sanitizeValidationCheckForDisplay({
      name: 'feature_flags',
      status: 'warn',
      message: 'write flag on',
      details: {
        flags: { dbWriteAIUsageEnabled: true, dbReadAIUsageEnabled: false },
        DATABASE_URL: 'postgres://user:pass@host/db',
        apiKey: 'sk-do-not-leak',
        password: 'do-not-leak',
        token: 'do-not-leak',
        cookie: 'session=leak',
        secret: 'do-not-leak',
        api_key: 'do-not-leak',
        authorization: 'Bearer leak',
        env: { ANTHROPIC_API_KEY: 'leak' },
        raw: 'leak',
        promptBody: 'leak',
        plainCount: 7,
      },
    });
    expect(out.name).toBe('feature_flags');
    expect(out.status).toBe('warn');
    expect(out.message).toBe('write flag on');
    expect(out.details).toBeDefined();
    expect(out.details.plainCount).toBe(7);
    expect(out.details.flags).toEqual({ dbWriteAIUsageEnabled: true, dbReadAIUsageEnabled: false });
    expect(out.details).not.toHaveProperty('DATABASE_URL');
    expect(out.details).not.toHaveProperty('apiKey');
    expect(out.details).not.toHaveProperty('api_key');
    expect(out.details).not.toHaveProperty('password');
    expect(out.details).not.toHaveProperty('token');
    expect(out.details).not.toHaveProperty('cookie');
    expect(out.details).not.toHaveProperty('secret');
    expect(out.details).not.toHaveProperty('authorization');
    expect(out.details).not.toHaveProperty('env');
    expect(out.details).not.toHaveProperty('raw');
    expect(out.details).not.toHaveProperty('promptBody');
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('postgres://user:pass');
    expect(serialized).not.toContain('sk-do-not-leak');
    expect(serialized).not.toContain('Bearer leak');
  });

  it('returns null for non-objects', () => {
    expect(sanitizeValidationCheckForDisplay(null)).toBeNull();
    expect(sanitizeValidationCheckForDisplay('check')).toBeNull();
  });

  it('sanitizeValidationChecksForDisplay returns empty array for non-arrays', () => {
    expect(sanitizeValidationChecksForDisplay(null)).toEqual([]);
    expect(sanitizeValidationChecksForDisplay({})).toEqual([]);
  });
});

describe('summarizeDbReadiness', () => {
  it('returns a sanitized summary for a pass payload with safe flag list', () => {
    const out = summarizeDbReadiness(SAMPLE_PASS_PAYLOAD, { nowMs: new Date('2026-06-30T12:00:00.000Z').getTime() });
    expect(out.status).toBe('pass');
    expect(out.tone).toBe('success');
    expect(out.label).toBe('Pass');
    expect(out.summaryLine).toBe('DB readiness: pass — 0 fail / 0 warn');
    expect(out.reminder).toMatch(/manual approval/i);
    expect(out.flags).toEqual({
      dbWriteAIUsageEnabled: false,
      dbReadAIUsageEnabled: false,
      dbWriteErrorLogEnabled: false,
      dbReadErrorLogEnabled: false,
    });
    expect(READINESS_SAFE_FLAG_NAMES).toEqual([
      'dbWriteAIUsageEnabled', 'dbReadAIUsageEnabled', 'dbWriteErrorLogEnabled', 'dbReadErrorLogEnabled',
    ]);
    expect(out.failingChecks).toEqual([]);
    expect(out.warningChecks).toEqual([]);
    expect(out.totalChecks).toBe(2);
    expect(out.recommendedCommandCount).toBe(1);
  });

  it('counts fail and warn checks and returns them in failingChecks/warningChecks arrays', () => {
    const out = summarizeDbReadiness({
      cache: { cached: false, cacheTtlSeconds: 30 },
      generatedAt: '2026-06-30T12:00:00.000Z',
      validation: {
        status: 'fail',
        checks: [
          { name: 'database_configured', status: 'fail', message: 'DATABASE_URL is not configured.', details: {} },
          { name: 'database_health', status: 'warn', message: 'skipped', details: {} },
          { name: 'documentation_present', status: 'pass', message: 'present', details: {} },
        ],
        recommendedCommands: [],
      },
    });
    expect(out.status).toBe('fail');
    expect(out.tone).toBe('danger');
    expect(out.failureCount).toBe(1);
    expect(out.warningCount).toBe(1);
    expect(out.summaryLine).toBe('DB readiness: fail — 1 fail / 1 warn');
    expect(out.failingChecks).toEqual([
      expect.objectContaining({ name: 'database_configured', status: 'fail' }),
    ]);
    expect(out.warningChecks).toEqual([
      expect.objectContaining({ name: 'database_health', status: 'warn' }),
    ]);
  });

  it('never includes DATABASE_URL or secret-shaped values in the summary', () => {
    const leaky = {
      cache: { cached: false, cacheTtlSeconds: 30 },
      generatedAt: '2026-06-30T12:00:00.000Z',
      validation: {
        status: 'pass',
        checks: [
          {
            name: 'database_configured',
            status: 'pass',
            message: 'ok',
            details: {
              configured: true,
              DATABASE_URL: 'postgres://user:supersecret@host/db',
              apiKey: 'sk-do-not-leak',
              Authorization: 'Bearer leak',
              cookie: 'session=leak',
              redactedDatabaseUrl: 'postgres://***:***@host/db',
            },
          },
        ],
        recommendedCommands: [],
      },
    };
    const out = summarizeDbReadiness(leaky);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('supersecret');
    expect(serialized).not.toContain('sk-do-not-leak');
    expect(serialized).not.toContain('Bearer leak');
    expect(serialized).not.toContain('session=leak');
    // The defense-in-depth filter strips even the redactedDatabaseUrl key
    // because its name matches /databaseurl/i — operator only sees safe scalars.
    expect(serialized).not.toMatch(/redactedDatabaseUrl/i);
  });

  it('returns null for non-objects or payloads missing validation', () => {
    expect(summarizeDbReadiness(null)).toBeNull();
    expect(summarizeDbReadiness({})).toBeNull();
    expect(summarizeDbReadiness({ validation: 'not-object' })).toBeNull();
  });

  it('falls back to status=unknown for unrecognized validation status', () => {
    const out = summarizeDbReadiness({
      validation: { status: 'maybe', checks: [], recommendedCommands: [] },
    });
    expect(out.status).toBe('unknown');
    expect(out.tone).toBe('neutral');
    expect(out.reminder).toBe('');
  });
});
