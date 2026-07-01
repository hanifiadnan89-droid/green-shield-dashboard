import { describe, expect, it, vi } from 'vitest';
import { loadRepliesData } from './loadRepliesData.js';

describe('loadRepliesData', () => {
  it('prefers the consolidated replies payload when available', async () => {
    const apiClient = {
      replies: {
        get: vi.fn().mockResolvedValue({
          leads: [{ row_number: 18, name: 'Reply Lead' }],
          threads: { 18: [{ id: '1', body: 'Need help' }] },
          meta: { 18: { preview: 'Need help', unread: true } },
          summary: { totalThreads: 1, unreadCount: 1 },
          unreadCount: 1,
          count: 1,
          sidebar: [{ rowNumber: 18, preview: 'Need help', unread: true }],
        }),
      },
      leads: {
        list: vi.fn(),
      },
      messages: {
        sync: vi.fn(),
      },
    };

    const payload = await loadRepliesData(apiClient);

    expect(apiClient.replies.get).toHaveBeenCalledTimes(1);
    expect(apiClient.leads.list).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      source: 'replies',
      leads: [{ row_number: 18, name: 'Reply Lead' }],
      threads: { 18: [{ id: '1', body: 'Need help' }] },
      meta: { 18: { preview: 'Need help', unread: true } },
      summary: { totalThreads: 1, unreadCount: 1 },
      unreadCount: 1,
      count: 1,
    });
  });

  it('falls back to the legacy leads + messages flow if the replies endpoint fails', async () => {
    const repliesErr = new Error('replies failed');
    const apiClient = {
      replies: {
        get: vi.fn().mockRejectedValue(repliesErr),
      },
      leads: {
        list: vi.fn().mockResolvedValue({
          leads: [
            { row_number: 9, name: 'Legacy Reply', sms_reply: 'Yes please', email_reply: '' },
          ],
        }),
      },
      messages: {
        sync: vi.fn().mockResolvedValue({
          threads: {
            9: [{ id: '1', direction: 'inbound', body: 'Yes please' }],
          },
          meta: {
            9: { preview: 'Yes please', unread: true },
          },
        }),
      },
    };

    const payload = await loadRepliesData(apiClient);

    expect(apiClient.replies.get).toHaveBeenCalledTimes(1);
    expect(apiClient.leads.list).toHaveBeenCalledTimes(1);
    expect(apiClient.messages.sync).toHaveBeenCalledTimes(1);
    expect(payload).toMatchObject({
      source: 'messages',
      leads: [{ row_number: 9, name: 'Legacy Reply', sms_reply: 'Yes please', email_reply: '' }],
      threads: { 9: [{ id: '1', direction: 'inbound', body: 'Yes please' }] },
      meta: { 9: { preview: 'Yes please', unread: true } },
      summary: { totalThreads: 1, unreadCount: 1 },
      unreadCount: 1,
      count: 1,
      repliesError: repliesErr,
    });
  });
});

