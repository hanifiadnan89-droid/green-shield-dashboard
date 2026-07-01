import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildAIContext: vi.fn(),
  buildSalesCoachContextOptions: vi.fn(),
  buildSalesCoachPromptInput: vi.fn(),
  executeAIRequest: vi.fn(),
  getRelevantExamplesWithFallback: vi.fn(),
  searchKnowledgeBase: vi.fn(),
}));

vi.mock('../ai/context/AIContextBuilder.js', () => ({
  buildAIContext: mocks.buildAIContext,
}));

vi.mock('../ai/adapters/salesCoachPromptAdapter.js', () => ({
  buildSalesCoachContextOptions: mocks.buildSalesCoachContextOptions,
  buildSalesCoachPromptInput: mocks.buildSalesCoachPromptInput,
}));

vi.mock('../ai/execution/AIExecutionEngine.js', () => ({
  executeAIRequest: mocks.executeAIRequest,
}));

vi.mock('../objectionKnowledge.js', () => ({
  loadOAKnowledge: () => 'Sales coach knowledge',
  getRelevantExamplesWithFallback: mocks.getRelevantExamplesWithFallback,
  formatExamplesForPrompt: () => '',
}));

vi.mock('../trainingService.js', () => ({
  getTrainingContext: () => 'Training context',
}));

vi.mock('../knowledgeBase/knowledgeBaseService.js', () => ({
  searchKnowledgeBase: mocks.searchKnowledgeBase,
  formatKnowledgeBaseContext: () => 'Knowledge Base context',
}));

import { runSalesCoachModule } from '../salesCoachEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('salesCoachEngine', () => {
  const currentUserContext = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mocks.buildSalesCoachContextOptions.mockReturnValue({ type: 'sales' });
    mocks.buildAIContext.mockResolvedValue({
      currentUser: { userId: 'user_ah' },
      sales: { summary: { total: 10 } },
      permissions: { canView: true, scope: 'organization' },
    });
    mocks.buildSalesCoachPromptInput.mockReturnValue({
      situation: 'Customer says it is too expensive',
      category: 'price',
      service: 'General Pest',
      personality: 'Analytical',
      propertyContext: { address: '123 Main St' },
      leadContext: { notes: 'Asked about price' },
      sessionId: 'session-1',
    });
    mocks.getRelevantExamplesWithFallback.mockResolvedValue([]);
    mocks.searchKnowledgeBase.mockResolvedValue([]);
    mocks.executeAIRequest.mockResolvedValue({
      json: {
        recommendedResponse: 'Recommended response',
        whyThisWorks: 'Why this works',
        salesStrategy: 'Sales strategy',
        softerVersion: 'Softer version',
        bestClosingQuestion: 'Can I get you scheduled?',
        thingsToAvoid: ['Do not discount immediately'],
        confidence: 91,
      },
      text: JSON.stringify({
        recommendedResponse: 'Recommended response',
        whyThisWorks: 'Why this works',
        salesStrategy: 'Sales strategy',
        softerVersion: 'Softer version',
        bestClosingQuestion: 'Can I get you scheduled?',
        thingsToAvoid: ['Do not discount immediately'],
        confidence: 91,
      }),
    });
  });

  it('uses AIContextBuilder and the Sales Coach prompt adapter while preserving response shape and model settings', async () => {
    const result = await runSalesCoachModule('objectionCoach', {
      situation: 'Customer says it is too expensive',
      category: 'price',
      service: 'General Pest',
      personality: 'Analytical',
      propertyContext: { address: '123 Main St' },
      leadContext: { notes: 'Asked about price' },
      sessionId: 'session-1',
    }, {
      req: { ip: '127.0.0.1' },
      endpoint: '/api/ai/sales-coach/module',
      currentUserContext,
      usageMetadata: {
        deprecatedRoute: true,
        deprecatedPath: '/api/ai/coach-objection',
        replacementPath: '/api/ai/sales-coach/module',
      },
    });

    expect(mocks.buildSalesCoachContextOptions).toHaveBeenCalledWith({
      situation: 'Customer says it is too expensive',
      category: 'price',
      service: 'General Pest',
      personality: 'Analytical',
      propertyContext: { address: '123 Main St' },
      leadContext: { notes: 'Asked about price' },
      sessionId: 'session-1',
    });
    expect(mocks.buildAIContext).toHaveBeenCalledWith(currentUserContext, { type: 'sales' });
    expect(mocks.buildSalesCoachPromptInput).toHaveBeenCalledWith({
      currentUser: { userId: 'user_ah' },
      sales: { summary: { total: 10 } },
      permissions: { canView: true, scope: 'organization' },
    }, {
      situation: 'Customer says it is too expensive',
      category: 'price',
      service: 'General Pest',
      personality: 'Analytical',
      propertyContext: { address: '123 Main St' },
      leadContext: { notes: 'Asked about price' },
      sessionId: 'session-1',
    });

    const [payload] = mocks.executeAIRequest.mock.calls[0];
    expect(payload.provider).toBe('anthropic');
    expect(payload.model).toBe('claude-sonnet-4-6');
    expect(payload.maxTokens).toBe(1100);
    expect(payload.endpoint).toBe('/api/ai/sales-coach/module');
    expect(payload.feature).toBe('objectionCoach');
    expect(payload.parseJson).toBe(true);
    expect(payload.usageMetadata).toEqual({
      deprecatedRoute: true,
      deprecatedPath: '/api/ai/coach-objection',
      replacementPath: '/api/ai/sales-coach/module',
    });
    expect(payload.system).toContain('You are a senior sales coach');
    expect(payload.messages[0].content).toContain('SITUATION:\n"Customer says it is too expensive"');

    expect(result).toEqual({
      recommendedResponse: 'Recommended response',
      whyThisWorks: 'Why this works',
      salesStrategy: 'Sales strategy',
      softerVersion: 'Softer version',
      bestClosingQuestion: 'Can I get you scheduled?',
      thingsToAvoid: ['Do not discount immediately'],
      knowledgeSources: [],
      confidence: 91,
      sessionId: 'session-1',
    });
  });

  it('returns a controlled error when AIContextBuilder cannot resolve accessible context', async () => {
    mocks.buildAIContext.mockResolvedValueOnce(null);

    await expect(runSalesCoachModule('objectionCoach', {
      situation: 'Customer says it is too expensive',
    }, {
      currentUserContext,
    })).rejects.toMatchObject({
      code: 'SALES_COACH_CONTEXT_NOT_FOUND',
      status: 404,
    });
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });

  it('requires current user context', async () => {
    await expect(runSalesCoachModule('objectionCoach', {
      situation: 'Customer says it is too expensive',
    })).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      status: 401,
    });
    expect(mocks.buildAIContext).not.toHaveBeenCalled();
    expect(mocks.executeAIRequest).not.toHaveBeenCalled();
  });

  it('does not import Sheets directly from the Sales Coach engine', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'salesCoachEngine.js'), 'utf8');
    expect(source).not.toContain("from './sheets.js'");
    expect(source).not.toContain('from "./sheets.js"');
    expect(source).not.toContain('services/sheets');
    expect(source).not.toContain('@anthropic-ai/sdk');
    expect(source).not.toContain('messages.create');
    expect(source).toContain("from './ai/execution/AIExecutionEngine.js'");
  });
});
