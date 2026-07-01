import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../../../domain/conversations/Conversation.js';

const mocks = vi.hoisted(() => ({
  getLeadByRowNumber: vi.fn(),
  getReplyThread: vi.fn(),
  getVisibleReplyThreads: vi.fn(),
  getDashboardData: vi.fn(),
}));

vi.mock('../../../sheets.js', () => {
  throw new Error('AI context builder must not import sheets.js directly');
});

vi.mock('../../../crmData/leadQueries.js', () => ({
  getLeadByRowNumber: mocks.getLeadByRowNumber,
}));

vi.mock('../../../crmData/replies/replyQueries.js', () => ({
  getReplyThread: mocks.getReplyThread,
  getVisibleReplyThreads: mocks.getVisibleReplyThreads,
}));

vi.mock('../../../crmData/dashboard/dashboardQueries.js', () => ({
  getDashboardData: mocks.getDashboardData,
}));

import {
  buildAIContext,
  buildConversationContext,
  buildDashboardContext,
  buildLeadContext,
  buildReplyContext,
  buildSalesContext,
} from '../AIContextBuilder.js';

describe('AIContextBuilder', () => {
  const context = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
    initials: 'AH',
    name: 'Adnan / AH',
    displayName: 'Adnan / AH',
    email: 'adnan@example.com',
  };

  const lead = {
    row_number: 18,
    name: 'Reply Lead',
    email: 'lead@example.com',
    phone: '2075550100',
    sms_reply: 'Need help',
    email_reply: '',
    status: 'active',
    ownership: {
      organizationId: 'org_green_shield',
      ownerUserId: 'user_ah',
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
      source: 'store',
    },
    visibility: {
      canView: true,
      canEdit: true,
      scope: 'organization',
    },
  };

  const conversation = Conversation.fromMessages([
    { id: 'out-1', direction: 'outbound', channel: 'sms', body: 'Hi there', ts: '2026-06-29T10:00:00.000Z' },
    { id: 'in-1', direction: 'inbound', channel: 'sms', body: 'Need help', ts: '2026-06-29T11:00:00.000Z' },
  ], {
    preview: 'Need help',
    lastAt: '2026-06-29T11:00:00.000Z',
    lastReadAt: null,
    lastReadInboundKey: null,
    readInboundKeys: [],
  }, lead);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';

    mocks.getLeadByRowNumber.mockResolvedValue(lead);
    mocks.getReplyThread.mockResolvedValue({
      lead,
      conversation: conversation.toJSON(),
      messages: conversation.messages(),
      meta: conversation.metadata(),
      summary: conversation.summary(),
    });
    mocks.getVisibleReplyThreads.mockResolvedValue({
      leads: [
        {
          ...lead,
          conversation: conversation.toJSON(),
          replyThread: {
            preview: 'Need help',
            lastAt: '2026-06-29T11:00:00.000Z',
            unread: true,
            lastReadAt: null,
            lastReadInboundKey: null,
            readInboundKeys: [],
          },
        },
      ],
      sidebar: [
        { rowNumber: 18, preview: 'Need help', unread: true },
      ],
      summary: {
        totalThreads: 1,
        unreadCount: 1,
      },
      unreadCount: 1,
      unreadRowNumbers: [18],
      count: 1,
      visibility: { canView: true, canEdit: true, scope: 'organization' },
      featureFlagState: { SCOPED_LEAD_ACCESS_ENABLED: true },
    });
    mocks.getDashboardData.mockResolvedValue({
      leads: [lead],
      stats: { total: 1, sold: 0 },
      summary: { totalLeads: 1, soldLeads: 0 },
      followups: { followupsDueCount: 0 },
      pipelineMetrics: { statusTotal: 1, todayActivity: [] },
      activity: [],
      count: 1,
    });
  });

  afterEach(() => {
    delete process.env.SCOPED_LEAD_ACCESS_ENABLED;
  });

  it('builds lead context from lead query data', async () => {
    const payload = await buildLeadContext(context, 18);

    expect(mocks.getLeadByRowNumber).toHaveBeenCalledWith(context, 18);
    expect(payload).toMatchObject({
      currentUser: {
        userId: 'user_ah',
        organizationId: 'org_green_shield',
        displayName: 'Adnan / AH',
      },
      lead: expect.objectContaining({
        row_number: 18,
        name: 'Reply Lead',
        computedStatus: 'replied',
        displayStatus: 'Replied',
        bestContactMethod: 'sms',
        actionable: false,
        needsFollowUp: false,
      }),
      permissions: {
        canView: true,
        canEdit: true,
        scope: 'organization',
        featureFlagState: { SCOPED_LEAD_ACCESS_ENABLED: true },
      },
      source: expect.objectContaining({
        contextVersion: 'ai-context-v1',
        rowNumber: 18,
      }),
    });
  });

  it('builds conversation context from reply query data', async () => {
    const payload = await buildConversationContext(context, 18);

    expect(mocks.getReplyThread).toHaveBeenCalledWith(context, 18);
    expect(payload).toMatchObject({
      conversation: expect.objectContaining({
        preview: 'Need help',
        unread: true,
        computedStatus: 'unread',
      }),
      summary: expect.objectContaining({
        preview: 'Need help',
        messageCount: 2,
      }),
      permissions: expect.objectContaining({
        canView: true,
        canEdit: true,
        scope: 'organization',
      }),
    });
  });

  it('builds reply context with selected thread and sidebar metadata', async () => {
    const payload = await buildReplyContext(context, 18);

    expect(mocks.getVisibleReplyThreads).toHaveBeenCalledWith(context);
    expect(mocks.getReplyThread).toHaveBeenCalledWith(context, 18);
    expect(payload).toMatchObject({
      reply: expect.objectContaining({
        selectedThread: expect.objectContaining({
          lead: expect.objectContaining({ row_number: 18 }),
          unread: true,
        }),
        sidebar: [
          expect.objectContaining({ rowNumber: 18, preview: 'Need help' }),
        ],
        summary: expect.objectContaining({
          totalThreads: 1,
          unreadCount: 1,
        }),
      }),
      permissions: expect.objectContaining({
        canView: true,
        canEdit: true,
        scope: 'organization',
      }),
    });
  });

  it('builds dashboard and sales contexts from dashboard queries only', async () => {
    const dashboardContext = await buildDashboardContext(context);
    const salesContext = await buildSalesContext(context);

    expect(mocks.getDashboardData).toHaveBeenCalledWith(context);
    expect(dashboardContext).toMatchObject({
      dashboard: expect.objectContaining({
        summary: { totalLeads: 1, soldLeads: 0 },
        stats: { total: 1, sold: 0 },
      }),
      summary: { totalLeads: 1, soldLeads: 0 },
    });
    expect(salesContext).toMatchObject({
      sales: expect.objectContaining({
        summary: { totalLeads: 1, soldLeads: 0 },
        stats: { total: 1, sold: 0 },
        recentLeads: [expect.objectContaining({ row_number: 18 })],
      }),
    });
  });

  it('builds combined AI context and returns null when a requested lead is inaccessible', async () => {
    const combined = await buildAIContext(context, { sections: ['lead', 'dashboard'], rowNumber: 18 });
    expect(combined).toMatchObject({
      currentUser: expect.objectContaining({ userId: 'user_ah' }),
      lead: expect.objectContaining({
        lead: expect.objectContaining({ row_number: 18 }),
      }),
      dashboard: expect.objectContaining({
        summary: { totalLeads: 1, soldLeads: 0 },
      }),
      source: expect.objectContaining({
        composite: true,
        requestedSections: ['lead', 'dashboard'],
      }),
    });

    mocks.getLeadByRowNumber.mockResolvedValue(null);
    mocks.getReplyThread.mockRejectedValueOnce(Object.assign(new Error('Reply thread not found'), {
      status: 404,
      code: 'NOT_FOUND',
    }));
    await expect(buildLeadContext(context, 999)).resolves.toBeNull();
    await expect(buildConversationContext(context, 999)).resolves.toBeNull();
    await expect(buildAIContext(context, { type: 'lead', rowNumber: 999 })).resolves.toBeNull();
  });
});
