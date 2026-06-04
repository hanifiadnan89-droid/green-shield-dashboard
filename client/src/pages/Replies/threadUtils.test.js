import { describe, it, expect } from 'vitest';
import {
  archKey,
  buildThreadFromMessages,
  getLatestInbound,
  leadMatchesConversationSearch,
  partitionSearchedReplyLeads,
  readKey,
} from './threadUtils.js';

describe('threadUtils', () => {
  it('builds ordered thread from server messages', () => {
    const lead = { row_number: 1, sent: '2024-01-01T10:00:00.000Z', notes: 'na' };
    const messages = [
      { id: 'a', direction: 'outbound', channel: 'sms', body: 'Hi', ts: '2024-01-01T10:00:00.000Z' },
      { id: 'b', direction: 'inbound', channel: 'sms', body: 'Thanks', ts: '2024-01-01T11:00:00.000Z' },
    ];
    const thread = buildThreadFromMessages(messages, lead, {});
    expect(thread).toHaveLength(3);
    expect(thread.map(m => m.text)).toContain('No-Answer follow-up sent');
    expect(thread[thread.length - 1].text).toBe('Thanks');
  });

  it('readKey uses stable inbound fingerprint', () => {
    const lead = { row_number: 5 };
    const key = readKey(lead, [{
      id: 'msg-99',
      direction: 'inbound',
      channel: 'sms',
      body: 'Hello',
      ts: '2024-01-01T12:00:00.000Z',
    }]);
    expect(key).toBe('5:sms|2024-01-01T12:00:00.000Z|Hello');
  });

  it('getLatestInbound skips outbound', () => {
    const messages = [
      { id: '1', direction: 'outbound', body: 'out' },
      { id: '2', direction: 'inbound', body: 'in' },
    ];
    expect(getLatestInbound(messages)?.body).toBe('in');
  });

  it('leadMatchesConversationSearch matches name and thread body', () => {
    const lead = { row_number: 1, name: 'Jane Doe', phone: '2075550100' };
    expect(leadMatchesConversationSearch(lead, 'jane', [])).toBe(true);
    expect(leadMatchesConversationSearch(lead, 'wasp', [{ body: 'We have wasps' }])).toBe(true);
    expect(leadMatchesConversationSearch(lead, 'nomatch', [])).toBe(false);
  });

  it('partitionSearchedReplyLeads hides archived unless showArchived', () => {
    const leads = [
      { row_number: 1, name: 'Active', sms_reply: 'hi' },
      { row_number: 2, name: 'Archived', sms_reply: 'bye' },
    ];
    const archived = new Set([archKey(leads[1])]);
    const threads = { 2: [{ body: 'secret archived note' }] };

    const noArch = partitionSearchedReplyLeads(leads, {
      search: 'secret',
      threads,
      archived,
      showArchived: false,
    });
    expect(noArch.matchCount).toBe(0);
    expect(noArch.archivedLeads).toHaveLength(0);

    const withArch = partitionSearchedReplyLeads(leads, {
      search: 'secret',
      threads,
      archived,
      showArchived: true,
    });
    expect(withArch.archivedLeads).toHaveLength(1);
    expect(withArch.activeLeads).toHaveLength(0);
  });

  it('partitionSearchedReplyLeads returns empty active list for no search matches', () => {
    const leads = [{ row_number: 1, name: 'Active', sms_reply: 'hi' }];
    const result = partitionSearchedReplyLeads(leads, {
      search: 'zzzzz',
      threads: {},
      archived: new Set(),
      showArchived: false,
    });
    expect(result.hasActiveSearch).toBe(true);
    expect(result.activeLeads).toHaveLength(0);
    expect(result.matchCount).toBe(0);
  });
});
