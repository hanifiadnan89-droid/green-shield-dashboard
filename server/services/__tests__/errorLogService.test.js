import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as service from '../errorLogService.js';

const ORIGINAL_ENV = { ...process.env };

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gs-error-log-'));
}

describe('errorLogService', () => {
  let dir;

  beforeEach(() => {
    dir = tempDir();
    process.env = {
      ...ORIGINAL_ENV,
      ERROR_LOG_DATA_DIR: dir,
      ERROR_LOG_STORAGE_BACKEND: 'persistent_disk',
      NODE_ENV: 'test',
      GIT_COMMIT: 'abc1234',
      APP_VERSION: '9.9.9-test',
      DEPLOYMENT_ID: 'deploy-test',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates and lists sanitized error records', () => {
    const error = service.createError({
      source: 'api',
      module: 'leads',
      endpoint: 'POST /api/leads',
      httpStatus: 500,
      errorCode: 'SHEETS_FAILED',
      message: 'Google Sheets failed with Bearer secret-token',
      rawMetadata: {
        Authorization: 'Bearer should-not-store',
        nested: { apiKey: 'abc123', ok: 'visible' },
      },
    });

    expect(error.id).toMatch(/^err_/);
    expect(error.severity).toBe('high');
    expect(error.message).toContain('[REDACTED]');
    expect(error.rawMetadata.Authorization).toBe('[REDACTED]');
    expect(error.rawMetadata.nested.apiKey).toBe('[REDACTED]');
    expect(error.rawMetadata.nested.ok).toBe('visible');

    const listed = service.listErrors({ query: 'sheets' });
    expect(listed.total).toBe(1);
    expect(listed.errors[0].id).toBe(error.id);
  });

  it('deduplicates repeated errors and increments occurrence count', () => {
    const first = service.createError({
      source: 'kb',
      module: 'ingestion',
      endpoint: 'POST /api/kb/upload',
      errorCode: 'PDF_FAILED',
      message: 'PDF parser failed for file 12345',
    });
    const second = service.createError({
      source: 'kb',
      module: 'ingestion',
      endpoint: 'POST /api/kb/upload',
      errorCode: 'PDF_FAILED',
      message: 'PDF parser failed for file 67890',
    });

    expect(second.id).toBe(first.id);
    expect(second.occurrenceCount).toBe(2);
    expect(service.listErrors().total).toBe(1);
  });

  it('stores stack traces only for server-side errors', () => {
    const frontend = service.createError({
      source: 'frontend',
      module: 'React',
      message: 'Render failed',
      stackTrace: 'browser stack should not be stored',
    });
    const backend = service.createError({
      source: 'api',
      module: 'Express',
      message: 'Route failed',
      stackTrace: 'server stack should be stored',
    });

    expect(frontend.stackTrace).toBe('');
    expect(backend.stackTrace).toBe('server stack should be stored');
  });

  it('updates status, resolves, archives, and filters errors', () => {
    const error = service.createError({
      source: 'frontend',
      severity: 'critical',
      module: 'SalesCoach',
      message: 'Render crashed',
    });

    const investigating = service.updateErrorStatus(error.id, 'investigating', { user: 'adnan', note: 'Checking logs' });
    expect(investigating.status).toBe('investigating');
    expect(investigating.timeline).toHaveLength(2);
    expect(investigating.timeline[1]).toMatchObject({
      user: 'adnan',
      oldStatus: 'new',
      newStatus: 'investigating',
      note: 'Checking logs',
    });

    const resolved = service.markErrorResolved(error.id, { user: 'adnan', note: 'Fixed config' });
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeTruthy();
    expect(resolved.timeline).toHaveLength(3);
    expect(service.listErrors({ status: 'resolved' }).total).toBe(1);
    expect(service.archiveError(error.id).status).toBe('archived');
    expect(service.listErrors().total).toBe(0);
    expect(service.listErrors({ includeArchived: true }).total).toBe(1);
  });

  it('populates deployment metadata and health dashboard summary', () => {
    const error = service.createError({
      source: 'api',
      severity: 'high',
      module: 'routes',
      message: 'Route Finder failed',
    });
    service.markErrorResolved(error.id);

    const detail = service.getErrorDetail(error.id);
    expect(detail.deployment).toMatchObject({
      gitCommitHash: 'abc1234',
      appVersion: '9.9.9-test',
      deploymentId: 'deploy-test',
      environment: 'test',
    });
    expect(detail.deployment.hostname).toBeTruthy();
    expect(detail.deployment.nodeVersion).toMatch(/^v/);

    const summary = service.summarizeErrors();
    expect(summary.errorsToday).toBeGreaterThanOrEqual(1);
    expect(summary.resolvedToday).toBeGreaterThanOrEqual(1);
    expect(summary.mttrMs).not.toBeUndefined();
    expect(summary.mostFailingModule.value).toBe('routes');
    expect(summary.errorTrend.last7Days).toBeGreaterThanOrEqual(1);
  });

  it('finds similar errors by message, stack, module, and code', () => {
    const first = service.createError({
      source: 'api',
      module: 'sheets',
      endpoint: 'GET /api/leads',
      errorCode: 'SHEETS_TIMEOUT',
      message: 'Google Sheets timed out while loading leads',
      stackTrace: 'at loadSheets\nat getLeads',
    });
    const second = service.createError({
      source: 'api',
      module: 'sheets',
      endpoint: 'POST /api/send',
      errorCode: 'SHEETS_TIMEOUT',
      message: 'Google Sheets timed out while sending quote',
      stackTrace: 'at loadSheets\nat sendQuote',
    });

    const similar = service.findSimilarErrors(first.id);
    expect(similar.some((error) => error.id === second.id)).toBe(true);
    expect(similar[0].similarityScore).toBeGreaterThan(0);
  });

  it('caches AI analysis on the error record', () => {
    const error = service.createError({
      source: 'api',
      module: 'pdf',
      message: 'PDF generation failed',
    });
    const updated = service.setErrorAnalysis(error.id, {
      probableRootCause: 'Missing PDF asset',
      confidenceLevel: 'medium',
      affectedSubsystem: 'pdf',
    });

    expect(updated.aiAnalysis).toMatchObject({
      probableRootCause: 'Missing PDF asset',
      confidenceLevel: 'medium',
      affectedSubsystem: 'pdf',
    });
    expect(updated.aiAnalysis.generatedAt).toBeTruthy();
  });

  it('refuses production Render writes without durable storage config', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      RENDER: 'true',
      NODE_ENV: 'production',
      ERROR_LOG_DATA_DIR: '',
      KNOWLEDGE_DATA_DIR: '',
      KNOWLEDGE_STORAGE_BACKEND: '',
    };
    expect(() => service.createError({ message: 'unsafe' })).toThrow(/Error Center production writes are disabled/);
  });
});
