import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildAIContext: vi.fn(),
  buildObjectionAssistantContextOptions: vi.fn(),
  buildObjectionAssistantPromptInput: vi.fn(),
  executeAIRequest: vi.fn(),
}));

vi.mock('../../services/ai/context/AIContextBuilder.js', () => ({
  buildAIContext: mocks.buildAIContext,
  buildReplyContext: vi.fn(),
}));

vi.mock('../../services/ai/adapters/assistReplyPromptAdapter.js', () => ({
  buildAssistReplyPromptInput: vi.fn(),
}));

vi.mock('../../services/ai/adapters/salesCoachPromptAdapter.js', () => ({
  buildSalesCoachContextOptions: vi.fn(),
  buildSalesCoachPromptInput: vi.fn(),
}));

vi.mock('../../services/ai/adapters/objectionAssistantPromptAdapter.js', () => ({
  buildObjectionAssistantContextOptions: mocks.buildObjectionAssistantContextOptions,
  buildObjectionAssistantPromptInput: mocks.buildObjectionAssistantPromptInput,
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

async function invokeObjectionAssist({ body, context = null }) {
  const req = {
    method: 'POST',
    url: '/objection-assist',
    path: '/objection-assist',
    originalUrl: '/api/ai/objection-assist',
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

describe('AI objection-assist route', () => {
  const currentUserContext = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildObjectionAssistantContextOptions.mockReturnValue({ type: 'sales' });
    mocks.buildAIContext.mockResolvedValue({
      currentUser: { userId: 'user_ah' },
      sales: { summary: {} },
    });
    mocks.buildObjectionAssistantPromptInput.mockReturnValue({
      context: {
        customerName: 'Adapter Lead',
        serviceType: 'General Pest',
        address: '123 Main St',
      },
      objection: 'Too expensive',
      action: null,
      existing_response: '',
    });
    mocks.executeAIRequest.mockResolvedValue({
      text: 'Here is the spoken response.',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
  });

  it('uses AIContextBuilder, prompt adapter, and AIExecutionEngine while preserving response shape', async () => {
    const body = {
      context: {
        customerName: 'Client Lead',
        serviceType: 'General Pest',
      },
      objection: 'Too expensive',
    };

    const res = await invokeObjectionAssist({ body, context: currentUserContext });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ response: 'Here is the spoken response.' });
    expect(mocks.buildObjectionAssistantContextOptions).toHaveBeenCalledWith({
      context: body.context,
      objection: 'Too expensive',
      action: null,
      existing_response: '',
    });
    expect(mocks.buildAIContext).toHaveBeenCalledWith(currentUserContext, { type: 'sales' });
    expect(mocks.buildObjectionAssistantPromptInput).toHaveBeenCalledWith(
      { currentUser: { userId: 'user_ah' }, sales: { summary: {} } },
      {
        context: body.context,
        objection: 'Too expensive',
        action: null,
        existing_response: '',
      },
    );

    const [executionPayload] = mocks.executeAIRequest.mock.calls[0];
    expect(executionPayload.provider).toBe('anthropic');
    expect(executionPayload.model).toBe('claude-sonnet-4-6');
    expect(executionPayload.maxTokens).toBe(350);
    expect(executionPayload.endpoint).toBe('/api/ai/objection-assist');
    expect(executionPayload.feature).toBe('objection-assist');
    expect(executionPayload.system).toContain('You are a Green Shield Pest Solutions sales rep');
    expect(executionPayload.messages[0].content).toContain('Customer name: Adapter Lead');
    expect(executionPayload.messages[0].content).toContain('Customer objection: "Too expensive"');
  });

  it('preserves transform action behavior without requiring rowNumber', async () => {
    mocks.buildObjectionAssistantPromptInput.mockReturnValueOnce({
      context: { customerName: 'Adapter Lead' },
      objection: 'Too expensive',
      action: 'shorten',
      existing_response: 'A longer response',
    });

    const res = await invokeObjectionAssist({
      context: currentUserContext,
      body: {
        context: { customerName: 'Client Lead' },
        objection: 'Too expensive',
        action: 'shorten',
        existing_response: 'A longer response',
      },
    });

    expect(res.statusCode).toBe(200);
    const [executionPayload] = mocks.executeAIRequest.mock.calls[0];
    expect(executionPayload.messages[0].content).toContain('Current response:\n"A longer response"');
    expect(executionPayload.messages[0].content).toContain('Instruction: Cut this down to 2–3 sentences.');
  });

  it('returns controlled 401 when currentUserContext is missing', async () => {
    const res = await invokeObjectionAssist({
      body: {
        context: {},
        objection: 'Too expensive',
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
    mocks.buildObjectionAssistantContextOptions.mockReturnValueOnce({
      sections: ['sales', 'lead', 'conversation'],
      rowNumber: 99,
    });
    mocks.buildAIContext.mockResolvedValueOnce(null);

    const res = await invokeObjectionAssist({
      context: currentUserContext,
      body: {
        context: { row_number: 99 },
        objection: 'Too expensive',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: 'Objection Assistant context not found.',
      code: 'OBJECTION_ASSISTANT_CONTEXT_NOT_FOUND',
    });
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });
});
