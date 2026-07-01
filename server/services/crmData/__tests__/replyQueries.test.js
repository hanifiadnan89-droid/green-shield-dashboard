import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getVisibleLeads: vi.fn(),
  getLeadByRowNumber: vi.fn(),
  syncLeadsMessages: vi.fn(),
  countUnreadForLeads: vi.fn(),
  getMessagesForLead: vi.fn(),
  getConversationPreview: vi.fn(),
  getThreadMeta: vi.fn(),
}));

vi.mock('../leadQueries.js', () => ({
  getVisibleLeads: mocks.getVisibleLeads,
  getLeadByRowNumber: mocks.getLeadByRowNumber,
}));

vi.mock('../../conversationMessages.js', () => ({
  syncLeadsMessages: mocks.syncLeadsMessages,
  countUnreadForLeads: mocks.countUnreadForLeads,
  getMessagesForLead: mocks.getMessagesForLead,
  getConversationPreview: mocks.getConversationPreview,
  getThreadMeta: mocks.getThreadMeta,
}));

import {
  getConversationMessages,
  getReplySidebar,
  getReplySummary,
  getReplyThread,
  getUnreadReplyCount,
  getVisibleReplyThreads,
} from '../replies/replyQueries.js';

describe('replyQueries', () => {
  const context = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
    initials: 'AH',
    name: 'Adnan / AH',
  };

  const lead = {
    row_number: 18,
    name: 'Reply Lead',
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

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getVisibleLeads.mockResolvedValue([lead]);
    mocks.getLeadByRowNumber.mockResolvedValue(lead);
    mocks.syncLeadsMessages.mockReturnValue({
      threads: {
        18: [{ id: '1', direction: 'inbound', body: 'Need help', ts: '2026-06-29T12:00:00.000Z' }],
      },
      meta: {
        18: {
          preview: 'Need help',
          lastAt: '2026-06-29T12:00:00.000Z',
          lastMessage: { body: 'Need help' },
          unread: true,
          lastReadAt: null,
          lastReadInboundKey: null,
          readInboundKeys: [],
          lastInboundAt: '2026-06-29T12:00:00.000Z',
        },
      },
      messages: [{ id: '1', direction: 'inbound', body: 'Need help', ts: '2026-06-29T12:00:00.000Z' }],
      preview: 'Need help',
      lastAt: '2026-06-29T12:00:00.000Z',
      lastMessage: { body: 'Need help' },
      lastReadAt: null,
      lastReadInboundKey: null,
      readInboundKeys: [],
      unread: true,
    });
    mocks.countUnreadForLeads.mockReturnValue({ count: 1, rowNumbers: [18] });
    mocks.getMessagesForLead.mockReturnValue([
      { id: '1', direction: 'inbound', body: 'Need help', ts: '2026-06-29T12:00:00.000Z' },
    ]);
    mocks.getConversationPreview.mockReturnValue({
      preview: 'Need help',
      lastAt: '2026-06-29T12:00:00.000Z',
      lastMessage: { body: 'Need help' },
    });
    mocks.getThreadMeta.mockReturnValue({
      preview: 'Need help',
      lastAt: '2026-06-29T12:00:00.000Z',
      lastMessage: { body: 'Need help' },
      unread: true,
      lastReadAt: null,
      lastReadInboundKey: null,
      readInboundKeys: [],
      lastInboundAt: '2026-06-29T12:00:00.000Z',
    });
  });

  it('returns visible reply threads with summary and unread metadata', async () => {
    const payload = await getVisibleReplyThreads(context);

    expect(mocks.getVisibleLeads).toHaveBeenCalledWith(context);
    expect(mocks.syncLeadsMessages).toHaveBeenCalledWith([lead], { legacyViewedKeys: [] });
    expect(payload).toMatchObject({
      leads: [
        expect.objectContaining({
          row_number: 18,
          conversation: expect.objectContaining({
            preview: 'Need help',
            unread: true,
          }),
          replyThread: expect.objectContaining({
            preview: 'Need help',
            unread: true,
          }),
        }),
      ],
      unreadCount: 1,
      count: 1,
      summary: expect.objectContaining({
        totalThreads: 1,
        unreadCount: 1,
        replied: 1,
      }),
      sidebar: [
        expect.objectContaining({
          rowNumber: 18,
          preview: 'Need help',
          unread: true,
        }),
      ],
    });
  });

  it('returns a single reply thread and message list', async () => {
    const thread = await getReplyThread(context, 18);

    expect(mocks.getLeadByRowNumber).toHaveBeenCalledWith(context, 18);
    expect(thread).toMatchObject({
      lead: expect.objectContaining({
        row_number: 18,
        replyThread: expect.objectContaining({
          preview: 'Need help',
        }),
      }),
      conversation: expect.objectContaining({
        preview: 'Need help',
        unread: true,
      }),
      messages: [
        expect.objectContaining({
          body: 'Need help',
        }),
      ],
      meta: expect.objectContaining({
        preview: 'Need help',
        unread: true,
      }),
    });
  });

  it('returns unread counts and helper payloads', async () => {
    await expect(getUnreadReplyCount(context)).resolves.toMatchObject({ count: 1, rowNumbers: [18] });
    await expect(getReplySidebar(context)).resolves.toEqual([
      expect.objectContaining({ rowNumber: 18 }),
    ]);
    await expect(getReplySummary(context)).resolves.toMatchObject({
      totalThreads: 1,
      unreadCount: 1,
    });
    await expect(getConversationMessages(context, 18)).resolves.toEqual([
      expect.objectContaining({ body: 'Need help' }),
    ]);
  });
});
