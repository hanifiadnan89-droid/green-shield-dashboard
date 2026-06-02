import { describe, it, expect } from 'vitest';
import { buildThreadFromMessages, getLatestInbound, readKey } from './threadUtils.js';

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

  it('readKey uses latest message id', () => {
    const lead = { row_number: 5 };
    const key = readKey(lead, [{ id: 'msg-99', direction: 'inbound', body: 'x' }]);
    expect(key).toBe('5:msg-99');
  });

  it('getLatestInbound skips outbound', () => {
    const messages = [
      { id: '1', direction: 'outbound', body: 'out' },
      { id: '2', direction: 'inbound', body: 'in' },
    ];
    expect(getLatestInbound(messages)?.body).toBe('in');
  });
});
