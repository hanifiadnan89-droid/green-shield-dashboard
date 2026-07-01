import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildReplyContext: vi.fn(),
  buildAssistReplyPromptInput: vi.fn(),
  executeAIRequest: vi.fn(),
}));

vi.mock('../../services/ai/context/AIContextBuilder.js', () => ({
  buildReplyContext: mocks.buildReplyContext,
}));

vi.mock('../../services/ai/adapters/assistReplyPromptAdapter.js', () => ({
  buildAssistReplyPromptInput: mocks.buildAssistReplyPromptInput,
}));

vi.mock('../../services/ai/execution/AIExecutionEngine.js', () => ({
  executeAIRequest: mocks.executeAIRequest,
}));

vi.mock('../../services/knowledge.js', () => ({
  loadKnowledge: () => 'Knowledge base rules',
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

async function invokeAssistReply({ body, context = null }) {
  const req = {
    method: 'POST',
    url: '/assist-reply',
    path: '/assist-reply',
    originalUrl: '/api/ai/assist-reply',
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

describe('AI assist-reply route', () => {
  const context = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
    initials: 'AH',
    name: 'Adnan / AH',
  };

  const replyContext = {
    currentUser: {
      userId: 'user_ah',
      organizationId: 'org_green_shield',
      role: 'admin',
      initials: 'AH',
    },
    reply: {
      selectedThread: {
        lead: {
          row_number: 18,
          name: 'Server Lead',
          phone: '2075550100',
          email: 'server@example.com',
          reason: 'ants',
          status: 'replied',
          notes: 'Server-side notes',
          sms_reply: 'Need help from server',
          email_reply: '',
          sent: '2026-06-29T10:00:00.000Z',
          stop: '',
          bestContactMethod: 'sms',
          visibility: {
            canView: true,
            canEdit: true,
            scope: 'organization',
          },
        },
        conversation: {
          hasSms: true,
          hasEmail: false,
          latestCustomerMessage: {
            direction: 'inbound',
            channel: 'sms',
            body: 'Need help from server',
            ts: '2026-06-29T11:00:00.000Z',
          },
          lastInbound: {
            direction: 'inbound',
            channel: 'sms',
            body: 'Need help from server',
            ts: '2026-06-29T11:00:00.000Z',
          },
          lastOutboundAt: '2026-06-29T10:00:00.000Z',
          unread: true,
        },
        messages: [
          {
            id: 'out-1',
            direction: 'outbound',
            channel: 'sms',
            body: 'Hi from Green Shield',
            ts: '2026-06-29T10:00:00.000Z',
          },
          {
            id: 'in-1',
            direction: 'inbound',
            channel: 'sms',
            body: 'Need help from server',
            ts: '2026-06-29T11:00:00.000Z',
          },
        ],
        metadata: {
          preview: 'Need help from server',
          unread: true,
        },
      },
    },
    permissions: {
      canView: true,
      canEdit: true,
      scope: 'organization',
    },
    source: {
      contextVersion: 'ai-context-v1',
      queryServices: ['crmData.replies.replyQueries.getReplyThread'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mocks.buildReplyContext.mockResolvedValue(replyContext);
    mocks.buildAssistReplyPromptInput.mockReturnValue({
      row_number: 18,
      name: 'Adapter Lead',
      phone: '2075550100',
      email: 'adapter@example.com',
      reason: 'ants',
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

  it('uses AIContextBuilder for assist-reply while preserving response shape and model settings', async () => {
    const res = await invokeAssistReply({
      context,
      body: {
        lead_context: {
          row_number: 18,
          name: 'Client Spoof',
          phone: '0000000000',
          last_customer_message: 'Client message should not be trusted',
        },
        user_prompt: 'Write a short reply',
        current_draft: 'Draft already typed',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.buildReplyContext).toHaveBeenCalledWith(context, 18);
    expect(mocks.buildAssistReplyPromptInput).toHaveBeenCalledWith(replyContext, {
      row_number: 18,
      name: 'Client Spoof',
      phone: '0000000000',
      last_customer_message: 'Client message should not be trusted',
    });
    expect(res.body).toEqual({
      draft: 'Server-side draft',
      human_review_required: false,
      review_reason: null,
    });

    const [payload] = mocks.executeAIRequest.mock.calls[0];
    expect(payload.provider).toBe('anthropic');
    expect(payload.model).toBe('claude-haiku-4-5-20251001');
    expect(payload.maxTokens).toBe(1024);
    expect(payload.endpoint).toBe('/api/ai/assist-reply');
    expect(payload.feature).toBe('assist-reply');
    expect(payload.system).toContain('You are the AI Response Assistant');
    expect(payload.messages[0].content).toContain('- Name: Adapter Lead');
    expect(payload.messages[0].content).toContain('- Phone: 2075550100');
    expect(payload.messages[0].content).toContain('Customer [sms] 2026-06-29T11:00:00.000Z: Need help from adapter');
    expect(payload.messages[0].content).toContain("CUSTOMER'S LATEST MESSAGE:\nNeed help from adapter");
    expect(payload.messages[0].content).not.toContain('Client Spoof');
    expect(payload.messages[0].content).not.toContain('Client message should not be trusted');
  });

  it('returns a controlled 404 when AIContextBuilder cannot resolve accessible reply context', async () => {
    mocks.buildReplyContext.mockResolvedValueOnce(null);

    const res = await invokeAssistReply({
      context,
      body: {
        lead_context: { row_number: 999 },
        user_prompt: 'Write a reply',
        current_draft: '',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: 'Reply context not found.',
      code: 'REPLY_CONTEXT_NOT_FOUND',
    });
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
    expect(mocks.buildAssistReplyPromptInput).not.toHaveBeenCalled();
  });

  it('requires rowNumber for server-side reply context resolution', async () => {
    const res = await invokeAssistReply({
      context,
      body: {
        lead_context: { name: 'Lead', phone: '2075550100' },
        user_prompt: 'Write a reply',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'rowNumber is required for AI reply context.',
      code: 'ROW_NUMBER_REQUIRED',
    });
    expect(mocks.buildReplyContext).not.toHaveBeenCalled();
    expect(mocks.buildAssistReplyPromptInput).not.toHaveBeenCalled();
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });

  it('does not import Sheets directly from the AI route', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '..', 'ai.js'), 'utf8');
    expect(routeSource).not.toContain("from '../services/sheets.js'");
    expect(routeSource).not.toContain('from "../services/sheets.js"');
    expect(routeSource).toContain("from '../services/ai/adapters/assistReplyPromptAdapter.js'");
    expect(routeSource).toContain("from '../services/ai/execution/AIExecutionEngine.js'");
    expect(routeSource).not.toContain('function buildAssistContextFromReplyContext');
  });
});
