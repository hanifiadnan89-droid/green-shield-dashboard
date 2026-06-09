import { describe, it, expect } from 'vitest';
import { mergeMessageLists } from './mergeMessages.js';

describe('mergeMessageLists', () => {
  it('merges and dedupes messages by direction/channel/body/ts', () => {
    const existing = [{
      id: 'a',
      direction: 'inbound',
      channel: 'sms',
      body: 'Hello',
      ts: '2026-06-01T10:00:00.000Z',
    }];
    const incoming = [
      {
        id: 'b',
        direction: 'outbound',
        channel: 'sms',
        body: 'Reply',
        ts: '2026-06-01T10:05:00.000Z',
      },
      {
        id: 'dup',
        direction: 'inbound',
        channel: 'sms',
        body: 'Hello',
        ts: '2026-06-01T10:00:00.000Z',
      },
    ];
    const merged = mergeMessageLists(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.map(m => m.body)).toEqual(['Hello', 'Reply']);
  });

  it('never returns fewer messages than existing when incoming is empty', () => {
    const existing = [{
      direction: 'outbound',
      channel: 'sms',
      body: 'Saved reply',
      ts: '2026-06-01T12:00:00.000Z',
    }];
    expect(mergeMessageLists(existing, [])).toHaveLength(1);
  });
});
