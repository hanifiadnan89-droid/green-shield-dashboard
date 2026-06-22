import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(__dirname, '..', '..', 'data', 'conversation-messages.json');

const mockWriteRepliesLastReadAt = vi.fn().mockResolvedValue({ updated: true });
const mockUpdateLead = vi.fn().mockResolvedValue({ updated: true });

vi.mock('../sheets.js', () => ({
  updateLead: mockUpdateLead,
  writeRepliesLastReadAt: mockWriteRepliesLastReadAt,
}));

describe('conversationMessages', () => {
  let mod;

  beforeEach(async () => {
    vi.clearAllMocks();
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

  it('persists read state by lastReadAt across sync and resync', async () => {
    const lead = { row_number: 99, name: 'Pat', sent: '2024-06-01T10:00:00.000Z', notes: 'na' };
    mod.syncLeadMessages({ ...lead, sms_reply: 'Need service' });
    const messages = mod.getMessagesForLead(99);
    const readKey = mod.getLatestInboundReadKey(messages);
    expect(readKey).toBeTruthy();

    const readState = await mod.markThreadRead(99, readKey);
    expect(readState.unread).toBe(false);
    expect(mod.getThreadMeta(99).unread).toBe(false);

    mod.syncLeadMessages({ ...lead, sms_reply: 'Need service' });
    expect(mod.getThreadMeta(99).unread).toBe(false);
  });

  it('hydrates read state from sheet column on sync', () => {
    const inboundTs = mod.stableInboundTs(101, 'sms', 'Hello');
    const lead = {
      row_number: 101,
      name: 'Lee',
      sent: '2024-06-01T10:00:00.000Z',
      notes: 'na',
      sms_reply: 'Hello',
      replies_last_read_at: inboundTs,
    };
    mod.syncLeadMessages(lead);
    expect(mod.getThreadMeta(101, lead).unread).toBe(false);
  });

  it('markAllInboundRead stores every inbound key and clears unread', async () => {
    const lead = { row_number: 88, name: 'Alex', sent: '2024-06-01T10:00:00.000Z', notes: 'na' };
    mod.syncLeadMessages({ ...lead, sms_reply: 'First' });
    mod.syncLeadMessages({ ...lead, sms_reply: 'Second' });
    const before = mod.getMessagesForLead(88).filter(m => m.direction === 'inbound');
    expect(before.length).toBeGreaterThanOrEqual(2);

    const readState = await mod.markAllInboundRead(88);
    expect(readState.unread).toBe(false);
    expect(readState.readInboundKeys.length).toBeGreaterThanOrEqual(2);
    expect(mod.getThreadMeta(88).unread).toBe(false);

    mod.syncLeadMessages({ ...lead, sms_reply: 'Second' });
    expect(mod.getThreadMeta(88).unread).toBe(false);
  });

  it('marks unread when new inbound arrives after read', async () => {
    const lead = { row_number: 100, name: 'Sam', sent: '2024-06-01T10:00:00.000Z', notes: 'na' };
    mod.syncLeadMessages({ ...lead, sms_reply: 'First' });
    const key1 = mod.getLatestInboundReadKey(mod.getMessagesForLead(100));
    await mod.markThreadRead(100, key1);
    mod.syncLeadMessages({ ...lead, sms_reply: 'Second' });
    expect(mod.getThreadMeta(100).unread).toBe(true);
  });

  it('uses stable inbound timestamps for the same sheet reply', () => {
    const lead = { row_number: 55, name: 'Kim', sent: '2024-06-01T10:00:00.000Z', notes: 'na', sms_reply: 'Same text' };
    mod.syncLeadMessages(lead);
    const ts1 = mod.getLastInboundAt(mod.getMessagesForLead(55));
    if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);
    mod.syncLeadMessages(lead);
    const ts2 = mod.getLastInboundAt(mod.getMessagesForLead(55));
    expect(ts1).toBe(ts2);
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

  it('persistReadAtToSheet uses updateLead with replies_last_read_at', async () => {
    const lead = { row_number: 200, name: 'Dana', sent: '2024-06-01T10:00:00.000Z', notes: 'na' };
    mod.syncLeadMessages({ ...lead, sms_reply: 'Need help' });
    const messages = mod.getMessagesForLead(200);
    const readKey = mod.getLatestInboundReadKey(messages);
    await mod.markThreadRead(200, readKey);

    expect(mockUpdateLead).toHaveBeenCalled();
    const [calledRowNumber, calledUpdates] = mockUpdateLead.mock.calls[0];
    expect(calledRowNumber).toBe(200);
    expect(typeof calledUpdates.replies_last_read_at).toBe('string');
  });

  it('persistReadAtToSheet passes the inbound message timestamp as replies_last_read_at', async () => {
    const lead = { row_number: 201, name: 'Morgan', sent: '2024-06-01T10:00:00.000Z', notes: 'na' };
    mod.syncLeadMessages({ ...lead, sms_reply: 'Call me' });
    const messages = mod.getMessagesForLead(201);
    const latestInbound = mod.getLatestInbound(messages);
    const readKey = mod.getLatestInboundReadKey(messages);
    await mod.markThreadRead(201, readKey);

    const [, calledUpdates] = mockUpdateLead.mock.calls[0];
    expect(calledUpdates.replies_last_read_at).toBe(latestInbound.ts);
  });

  it('read state survives JSON deletion when replies_last_read_at is in the sheet', async () => {
    const body = 'Surviving reply';
    const stableTs = mod.stableInboundTs(202, 'sms', body);
    const lead = {
      row_number: 202,
      name: 'River',
      sent: '2024-06-01T10:00:00.000Z',
      notes: 'na',
      sms_reply: body,
      replies_last_read_at: stableTs,
    };

    // Simulate: JSON was deleted (server restart), sheet has replies_last_read_at
    if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);

    mod.syncLeadMessages(lead);
    expect(mod.getThreadMeta(202, lead).unread).toBe(false);
  });

  it('thread shows unread after JSON deletion when replies_last_read_at is absent', () => {
    const lead = {
      row_number: 203,
      name: 'Quinn',
      sent: '2024-06-01T10:00:00.000Z',
      notes: 'na',
      sms_reply: 'New message',
      // no replies_last_read_at — as if persistReadAtToSheet never wrote it
    };

    if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);

    mod.syncLeadMessages(lead);
    expect(mod.getThreadMeta(203, lead).unread).toBe(true);
  });
});
