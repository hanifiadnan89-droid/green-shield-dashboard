import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeAIRequest: vi.fn(),
  archiveError: vi.fn(),
  createError: vi.fn(),
  findSimilarErrors: vi.fn(),
  getErrorDetail: vi.fn(),
  getErrorLogStorageStatus: vi.fn(),
  initializeErrorLogStorage: vi.fn(),
  listErrors: vi.fn(),
  markErrorResolved: vi.fn(),
  setErrorAnalysis: vi.fn(),
  summarizeErrors: vi.fn(),
  updateErrorStatus: vi.fn(),
}));

vi.mock('../../services/errorLogRecorder.js', () => ({
  archiveError: mocks.archiveError,
  createError: mocks.createError,
  findSimilarErrors: mocks.findSimilarErrors,
  getErrorDetail: mocks.getErrorDetail,
  getErrorLogStorageStatus: mocks.getErrorLogStorageStatus,
  initializeErrorLogStorage: mocks.initializeErrorLogStorage,
  listErrors: mocks.listErrors,
  markErrorResolved: mocks.markErrorResolved,
  setErrorAnalysis: mocks.setErrorAnalysis,
  summarizeErrors: mocks.summarizeErrors,
  updateErrorStatus: mocks.updateErrorStatus,
}));

vi.mock('../../services/ai/execution/AIExecutionEngine.js', () => ({
  executeAIRequest: mocks.executeAIRequest,
}));

import errorsRouter from '../errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createMockResponse() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      resolve(this);
      return this;
    },
  };
  return { res, done };
}

async function invokeAnalyze({ id = 'err_1', body = {}, originalUrl = `/api/errors/${id}/analyze` } = {}) {
  return invokeErrorsRoute({
    method: 'POST',
    url: `/${id}/analyze`,
    originalUrl,
    body,
  });
}

async function invokeErrorsRoute({
  method = 'GET',
  url = '/',
  body = {},
  query = {},
  headers = {},
  originalUrl = `/api/errors${url === '/' ? '' : url}`,
} = {}) {
  const req = {
    method,
    url,
    path: url.split('?')[0],
    originalUrl,
    baseUrl: '/api/errors',
    headers,
    body,
    query,
    ip: '127.0.0.1',
  };
  const { res, done } = createMockResponse();
  await new Promise((resolve, reject) => {
    errorsRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
    done.then(resolve).catch(reject);
  });
  return res;
}

function createErrorRecord(overrides = {}) {
  return {
    id: 'err_1',
    source: 'api',
    module: 'pdf',
    endpoint: 'POST /api/documents/generate',
    httpStatus: 500,
    errorCode: 'PDF_FAILED',
    message: 'PDF generation failed',
    stackTrace: 'at buildPdf\nat route',
    firstSeenAt: '2026-06-29T10:00:00.000Z',
    lastSeenAt: '2026-06-29T11:00:00.000Z',
    occurrenceCount: 2,
    deployment: {
      gitCommitHash: 'abc123',
      environment: 'test',
    },
    rawMetadata: {
      file: 'quote.pdf',
    },
    ...overrides,
  };
}

describe('Error Center AI analysis route', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      ANTHROPIC_API_KEY: 'test-key',
      NODE_ENV: 'test',
    };
    mocks.getErrorDetail.mockReturnValue(createErrorRecord());
    mocks.listErrors.mockReturnValue({ errors: [createErrorRecord()], total: 1 });
    mocks.summarizeErrors.mockReturnValue({ total: 1, unresolved: 1 });
    mocks.createError.mockReturnValue(createErrorRecord({ id: 'err_created', source: 'frontend' }));
    mocks.updateErrorStatus.mockReturnValue(createErrorRecord({ status: 'investigating' }));
    mocks.findSimilarErrors.mockReturnValue([
      {
        id: 'err_2',
        source: 'api',
        module: 'pdf',
        message: 'PDF generation failed again',
        errorCode: 'PDF_FAILED',
        occurrenceCount: 3,
        similarityScore: 0.91,
      },
    ]);
    mocks.executeAIRequest.mockResolvedValue({
      text: JSON.stringify({
        probableRootCause: 'The PDF template asset is missing.',
        confidenceLevel: 'medium',
        affectedSubsystem: 'pdf',
        likelyRegression: 'unknown',
        recommendedFix: 'Verify document assets and PDF route inputs.',
        recommendedFilesOrModules: ['server/routes/documents.js'],
        troubleshootingChecklist: ['Check document asset paths'],
      }),
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });
    mocks.setErrorAnalysis.mockImplementation((id, analysis) => ({
      ...createErrorRecord({ id }),
      aiAnalysis: analysis,
    }));
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('lists errors through ErrorLogRecorder while preserving response shape', async () => {
    const res = await invokeErrorsRoute({ query: { severity: 'high', limit: '10' } });

    expect(res.statusCode).toBe(200);
    expect(mocks.listErrors).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'high',
      limit: '10',
    }));
    expect(res.body).toEqual({
      errors: [expect.objectContaining({ id: 'err_1' })],
      total: 1,
      summary: { total: 1, unresolved: 1 },
    });
  });

  it('creates frontend errors through ErrorLogRecorder while preserving response shape', async () => {
    const res = await invokeErrorsRoute({
      method: 'POST',
      url: '/',
      body: {
        message: 'Client crashed',
        metadata: { component: 'Replies' },
      },
      headers: {
        'user-agent': 'vitest',
        referer: '/replies',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mocks.createError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Client crashed',
      source: 'frontend',
      endpoint: '/replies',
      rawMetadata: expect.objectContaining({
        userAgent: 'vitest',
        referer: '/replies',
        component: 'Replies',
      }),
    }));
    expect(res.body).toEqual({ error: expect.objectContaining({ id: 'err_created' }) });
  });

  it('updates status through ErrorLogRecorder while preserving response shape', async () => {
    const res = await invokeErrorsRoute({
      method: 'PATCH',
      url: '/err_1/status',
      body: { status: 'investigating', user: 'adnan', note: 'Checking logs' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.updateErrorStatus).toHaveBeenCalledWith('err_1', 'investigating', {
      user: 'adnan',
      note: 'Checking logs',
    });
    expect(res.body).toEqual({ error: expect.objectContaining({ status: 'investigating' }) });
  });

  it('uses AIExecutionEngine while preserving model settings and response shape', async () => {
    const res = await invokeAnalyze();

    expect(res.statusCode).toBe(200);
    expect(mocks.executeAIRequest).toHaveBeenCalledTimes(1);
    const [payload] = mocks.executeAIRequest.mock.calls[0];
    expect(payload.provider).toBe('anthropic');
    expect(payload.model).toBe('claude-haiku-4-5-20251001');
    expect(payload.maxTokens).toBe(1200);
    expect(payload.endpoint).toBe('/api/errors/err_1/analyze');
    expect(payload.feature).toBe('error-center-analysis');
    expect(payload.system).toBe('You are an incident analysis assistant for Green Shield CRM. Return concise JSON only.');
    expect(payload.messages[0].content).toContain('Analyze this CRM operational error');
    expect(payload.messages[0].content).toContain('"id": "err_1"');

    expect(res.body).toEqual({
      analysis: expect.objectContaining({
        probableRootCause: 'The PDF template asset is missing.',
        confidenceLevel: 'medium',
        affectedSubsystem: 'pdf',
        model: 'claude-haiku-4-5-20251001',
        generatedAt: expect.any(String),
      }),
      cached: false,
    });
  });

  it('returns cached analysis without calling AIExecutionEngine unless forced', async () => {
    mocks.getErrorDetail.mockReturnValueOnce(createErrorRecord({
      aiAnalysis: {
        probableRootCause: 'Cached result',
        confidenceLevel: 'high',
      },
    }));

    const res = await invokeAnalyze();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      analysis: {
        probableRootCause: 'Cached result',
        confidenceLevel: 'high',
      },
      cached: true,
    });
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });

  it('preserves missing API key response without direct provider construction', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await invokeAnalyze();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      analysis: null,
      cached: false,
      unavailable: true,
      error: 'AI analysis is unavailable because ANTHROPIC_API_KEY is not configured.',
    });
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });

  it('handles provider failure safely without leaking provider internals', async () => {
    mocks.executeAIRequest.mockRejectedValueOnce(new Error('raw provider stack and secret details'));

    const res = await invokeAnalyze();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      analysis: null,
      cached: false,
      unavailable: true,
      error: 'AI analysis is unavailable right now.',
    });
  });

  it('keeps malformed JSON fallback behavior', async () => {
    mocks.executeAIRequest.mockResolvedValueOnce({
      text: 'Plain text analysis',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });

    const res = await invokeAnalyze();

    expect(res.statusCode).toBe(200);
    expect(res.body.analysis).toMatchObject({
      probableRootCause: 'Plain text analysis',
      confidenceLevel: 'low',
      affectedSubsystem: 'unknown',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('does not import Anthropic or OpenAI directly from routes/errors.js', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '..', 'errors.js'), 'utf8');
    expect(routeSource).not.toContain('@anthropic-ai/sdk');
    expect(routeSource).not.toContain("from 'openai'");
    expect(routeSource).not.toContain('from "openai"');
    expect(routeSource).not.toContain('messages.create');
    expect(routeSource).toContain("from '../services/ai/execution/AIExecutionEngine.js'");
  });
});
