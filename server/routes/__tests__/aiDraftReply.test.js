import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildAIContext: vi.fn(),
  buildReplyContext: vi.fn(),
  buildDraftReplyContextOptions: vi.fn(),
  buildDraftReplyPromptInput: vi.fn(),
  executeAIRequest: vi.fn(),
}));

vi.mock('../../services/ai/context/AIContextBuilder.js', () => ({
  buildAIContext: mocks.buildAIContext,
  buildReplyContext: mocks.buildReplyContext,
}));

vi.mock('../../services/ai/adapters/assistReplyPromptAdapter.js', () => ({
  buildAssistReplyPromptInput: vi.fn(),
}));

vi.mock('../../services/ai/adapters/salesCoachPromptAdapter.js', () => ({
  buildSalesCoachContextOptions: vi.fn(),
  buildSalesCoachPromptInput: vi.fn(),
}));

vi.mock('../../services/ai/adapters/objectionAssistantPromptAdapter.js', () => ({
  buildObjectionAssistantContextOptions: vi.fn(),
  buildObjectionAssistantPromptInput: vi.fn(),
}));

vi.mock('../../services/ai/adapters/draftReplyPromptAdapter.js', () => ({
  buildDraftReplyContextOptions: mocks.buildDraftReplyContextOptions,
  buildDraftReplyPromptInput: mocks.buildDraftReplyPromptInput,
}));

vi.mock('../../services/ai/execution/AIExecutionEngine.js', () => ({
  executeAIRequest: mocks.executeAIRequest,
}));

vi.mock('../../services/knowledge.js', () => ({
  loadKnowledge: () => 'Knowledge base rules',
}));

vi.mock('../../services/objectionKnowledge.js', () => ({
  loadOAKnowledge: () => 'Objection knowledge',
  appendFeedback: vi.fn(),
  appendCase: vi.fn(),
  getRelevantExamplesWithFallback: vi.fn().mockResolvedValue([]),
  formatExamplesForPrompt: () => '',
}));

vi.mock('../../services/trainingService.js', () => ({
  listTrainingItems: vi.fn(),
  createTrainingItem: vi.fn(),
  updateTrainingItem: vi.fn(),
  deleteTrainingItem: vi.fn(),
  upsertSession: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock('../../services/salesCoachEngine.js', () => ({
  runSalesCoachModule: vi.fn(),
  getSupportedModules: () => ['objectionCoach'],
}));

import aiRouter from '../ai.js';

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

async function invokeDraftReply({ body, context = null }) {
  const req = {
    method: 'POST',
    url: '/draft-reply',
    path: '/draft-reply',
    originalUrl: '/api/ai/draft-reply',
    baseUrl: '/api/ai',
    headers: {},
    body,
    currentUserContext: context,
    ip: '127.0.0.1',
  };
  const { res, done } = createMockResponse();
  await new Promise((resolve, reject) => {
    aiRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
    done.then(resolve).catch(reject);
  });
  return res;
}

describe('AI draft-reply route', () => {
  const currentUserContext = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
  };

  const aiContext = {
    currentUser: { userId: 'user_ah' },
    sales: { summary: {} },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildDraftReplyContextOptions.mockReturnValue({ type: 'sales' });
    mocks.buildAIContext.mockResolvedValue(aiContext);
    mocks.buildDraftReplyPromptInput.mockReturnValue({
      name: 'Adapter Lead',
      phone: '2075550100',
      email: 'adapter@example.com',
      town: 'Portland',
      address: '123 Main St',
      reason: 'ants',
      pest_type: 'Ants',
      lead_source: 'Website',
      lead_stage: 'customer_replied',
      status: 'replied',
      notes: 'Adapter notes',
      sms_reply: true,
      email_reply: false,
      last_customer_message: 'Need help from adapter',
      conversation_history: [
        {
          role: 'agent',
          text: 'Hi from Green Shield',
          ts: '2026-06-29T10:00:00.000Z',
          channel: 'sms',
        },
        {
          role: 'customer',
          text: 'Need help from adapter',
          ts: '2026-06-29T11:00:00.000Z',
          channel: 'sms',
        },
      ],
      last_contacted_at: '2026-06-29T10:00:00.000Z',
      follow_up_step: 'follow_up_1',
      agreement_sent: false,
      quote_sent: false,
      preferred_contact_method: 'sms',
      stop: false,
    });
    mocks.executeAIRequest.mockResolvedValue({
      text: JSON.stringify({
        draft: 'Server-side draft',
        human_review_required: false,
        review_reason: null,
      }),
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('uses AIContextBuilder, Draft Reply adapter, and AIExecutionEngine while preserving response shape', async () => {
    const leadContext = {
      name: 'Client Lead',
      phone: '0000000000',
      last_customer_message: 'Client message should not be trusted',
    };

    const res = await invokeDraftReply({
      context: currentUserContext,
      body: { lead_context: leadContext },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.buildDraftReplyContextOptions).toHaveBeenCalledWith({ lead_context: leadContext });
    expect(mocks.buildAIContext).toHaveBeenCalledWith(currentUserContext, { type: 'sales' });
    expect(mocks.buildDraftReplyPromptInput).toHaveBeenCalledWith(aiContext, { lead_context: leadContext });
    expect(res.body).toEqual({
      draft: 'Server-side draft',
      human_review_required: false,
      review_reason: null,
    });

    const [executionPayload] = mocks.executeAIRequest.mock.calls[0];
    expect(executionPayload.provider).toBe('anthropic');
    expect(executionPayload.model).toBe('claude-haiku-4-5-20251001');
    expect(executionPayload.maxTokens).toBe(512);
    expect(executionPayload.endpoint).toBe('/api/ai/draft-reply');
    expect(executionPayload.feature).toBe('draft-reply');
    expect(executionPayload.usageMetadata).toEqual({
      deprecatedRoute: true,
      deprecatedPath: '/api/ai/draft-reply',
      replacementPath: '/api/ai/assist-reply',
    });
    expect(executionPayload.system).toContain('You are the AI reply assistant');
    expect(executionPayload.messages[0].content).toContain('- Name: Adapter Lead');
    expect(executionPayload.messages[0].content).toContain('- Phone: 2075550100');
    expect(executionPayload.messages[0].content).toContain('Customer [sms] 2026-06-29T11:00:00.000Z: Need help from adapter');
    expect(executionPayload.messages[0].content).toContain('TASK: Draft a reply SMS from Adnan at Green Shield Pest Solutions');
    expect(executionPayload.messages[0].content).not.toContain('Client Lead');
    expect(executionPayload.messages[0].content).not.toContain('Client message should not be trusted');
  });

  it('passes row-scoped context options through the builder when rowNumber is provided', async () => {
    mocks.buildDraftReplyContextOptions.mockReturnValueOnce({
      sections: ['reply', 'lead', 'conversation'],
      rowNumber: 44,
    });

    await invokeDraftReply({
      context: currentUserContext,
      body: {
        lead_context: {
          row_number: 44,
          name: 'Saved Lead',
          phone: '2075550100',
        },
      },
    });

    expect(mocks.buildAIContext).toHaveBeenCalledWith(currentUserContext, {
      sections: ['reply', 'lead', 'conversation'],
      rowNumber: 44,
    });
  });

  it('returns controlled 401 when currentUserContext is missing', async () => {
    const res = await invokeDraftReply({
      body: {
        lead_context: {
          name: 'Lead',
          phone: '2075550100',
        },
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    expect(mocks.buildAIContext).not.toHaveBeenCalled();
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });

  it('returns controlled 404 when row-scoped context cannot be resolved', async () => {
    mocks.buildDraftReplyContextOptions.mockReturnValueOnce({
      sections: ['reply', 'lead', 'conversation'],
      rowNumber: 999,
    });
    mocks.buildAIContext.mockResolvedValueOnce(null);

    const res = await invokeDraftReply({
      context: currentUserContext,
      body: {
        lead_context: {
          row_number: 999,
          name: 'Lead',
          phone: '2075550100',
        },
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: 'Draft Reply context not found.',
      code: 'DRAFT_REPLY_CONTEXT_NOT_FOUND',
    });
    expect(mocks.buildDraftReplyPromptInput).not.toHaveBeenCalled();
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });

  it('preserves existing no-row behavior through sales context', async () => {
    const res = await invokeDraftReply({
      context: currentUserContext,
      body: {
        lead_context: {
          name: 'Unsaved Lead',
          phone: '2075550100',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.buildDraftReplyContextOptions).toHaveBeenCalledWith({
      lead_context: {
        name: 'Unsaved Lead',
        phone: '2075550100',
      },
    });
    expect(mocks.buildAIContext).toHaveBeenCalledWith(currentUserContext, { type: 'sales' });
  });

  it('preserves malformed JSON fallback behavior', async () => {
    mocks.executeAIRequest.mockResolvedValueOnce({
      text: 'Plain text draft',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });

    const res = await invokeDraftReply({
      context: currentUserContext,
      body: {
        lead_context: {
          name: 'Lead',
          phone: '2075550100',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      draft: 'Plain text draft',
      human_review_required: true,
      review_reason: 'AI response was not valid JSON — review before sending.',
    });
  });

  it('preserves STOP escalation behavior without calling the model', async () => {
    mocks.buildDraftReplyPromptInput.mockReturnValueOnce({
      name: 'Adapter Lead',
      phone: '2075550100',
      last_customer_message: 'stop',
      stop: true,
    });

    const res = await invokeDraftReply({
      context: currentUserContext,
      body: {
        lead_context: {
          name: 'Lead',
          phone: '2075550100',
          stop: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      draft: '',
      human_review_required: true,
      review_reason: 'Customer has opted out (STOP received). Do not send any messages.',
    });
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });

  it('does not import Sheets or Anthropic directly from the AI route', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '..', 'ai.js'), 'utf8');
    expect(routeSource).not.toContain("from '../services/sheets.js'");
    expect(routeSource).not.toContain('from "../services/sheets.js"');
    expect(routeSource).not.toContain("from '@anthropic-ai/sdk'");
    expect(routeSource).toContain("from '../services/ai/adapters/draftReplyPromptAdapter.js'");
    expect(routeSource).toContain("from '../services/ai/execution/AIExecutionEngine.js'");
  });

  it('sets Deprecation and X-GreenShield-Replacement headers without changing the JSON body', async () => {
    const res = await invokeDraftReply({
      context: currentUserContext,
      body: { lead_context: { name: 'Lead', phone: '2075550100' } },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      draft: 'Server-side draft',
      human_review_required: false,
      review_reason: null,
    });
    expect(res.headers.Deprecation).toBe('true');
    expect(res.headers['X-GreenShield-Replacement']).toBe('/api/ai/assist-reply');
    const headerSerialized = JSON.stringify(res.headers);
    expect(headerSerialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(headerSerialized).not.toContain('Bearer');
    expect(headerSerialized).not.toContain('lead_context');
    expect(headerSerialized).not.toContain('2075550100');
  });
});
