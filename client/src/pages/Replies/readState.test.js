import { describe, it, expect } from 'vitest';
import { isInboundNewerThanRead } from './readState.js';

describe('isInboundNewerThanRead', () => {
  it('returns false when inbound is not newer than lastReadAt', () => {
    const messages = [
      { direction: 'inbound', body: 'Hi', ts: '2026-06-01T12:00:00.000Z', channel: 'sms' },
    ];
    const meta = {
      lastInboundAt: '2026-06-01T12:00:00.000Z',
      lastReadAt: '2026-06-01T12:05:00.000Z',
    };
    expect(isInboundNewerThanRead(messages, meta, {}, 1)).toBe(false);
  });

  it('returns true when inbound is newer than lastReadAt', () => {
    const messages = [
      { direction: 'inbound', body: 'New msg', ts: '2026-06-02T12:00:00.000Z', channel: 'sms' },
    ];
    const meta = {
      lastInboundAt: '2026-06-02T12:00:00.000Z',
      lastReadAt: '2026-06-01T12:05:00.000Z',
    };
    expect(isInboundNewerThanRead(messages, meta, {}, 1)).toBe(true);
  });

  it('returns false when there is no inbound', () => {
    expect(isInboundNewerThanRead([], {}, {}, 1)).toBe(false);
  });

  it('returns false when latest inbound key is in readInboundKeys', () => {
    const messages = [
      { direction: 'inbound', body: 'Hi', ts: '2026-06-01T12:00:00.000Z', channel: 'sms' },
    ];
    const latestKey = 'sms|2026-06-01T12:00:00.000Z|Hi';
    expect(isInboundNewerThanRead(messages, { readInboundKeys: [latestKey] }, {}, 1)).toBe(false);
  });
});
