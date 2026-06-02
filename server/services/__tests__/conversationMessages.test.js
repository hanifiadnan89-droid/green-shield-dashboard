import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(__dirname, '..', '..', 'data', 'conversation-messages.json');

describe('conversationMessages', () => {
  let mod;

  beforeEach(async () => {
    if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);
    mod = await import('../conversationMessages.js');
  });

  afterEach(() => {
    if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);
  });

  it('appends inbound SMS and preserves prior value when sheet overwrites', () => {
    const lead = { row_number: 42, name: 'Jane', sent: '2024-06-01T10:00:00.000Z', notes: 'na' };
    mod.syncLeadMessages({ ...lead, sms_reply: 'First reply' });
    const second = mod.syncLeadMessages({ ...lead, sms_reply: 'Second reply' });
    const bodies = second.messages.filter(m => m.direction === 'inbound').map(m => m.body);
    expect(bodies).toContain('First reply');
    expect(bodies).toContain('Second reply');
  });

  it('appends outbound without duplicating', () => {
    mod.appendMessage(7, {
      direction: 'outbound',
      channel: 'sms',
      body: 'Hello there',
      ts: '2024-06-01T12:00:00.000Z',
      sender: 'You',
    });
    mod.appendMessage(7, {
      direction: 'outbound',
      channel: 'sms',
      body: 'Hello there',
      ts: '2024-06-01T12:00:00.000Z',
      sender: 'You',
    });
    const msgs = mod.getMessagesForLead(7);
    expect(msgs.filter(m => m.body === 'Hello there')).toHaveLength(1);
  });

  it('includes template outbound from lead.sent', () => {
    const { messages } = mod.syncLeadMessages({
      row_number: 3,
      sent: '2024-06-01T09:00:00.000Z',
      notes: 'ag',
      sms_reply: 'Thanks',
    });
    expect(messages.some(m => m.meta?.isTemplate)).toBe(true);
    expect(messages.some(m => m.direction === 'inbound' && m.body === 'Thanks')).toBe(true);
  });
});
