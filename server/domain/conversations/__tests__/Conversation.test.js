import { describe, expect, it } from 'vitest';
import { Conversation } from '../Conversation.js';

function buildMessages() {
  return [
    { id: 'out-1', direction: 'outbound', channel: 'sms', body: 'Hi there', ts: '2026-06-29T10:00:00.000Z', sender: 'You' },
    { id: 'in-1', direction: 'inbound', channel: 'sms', body: 'Need help', ts: '2026-06-29T11:00:00.000Z', sender: 'Customer' },
    { id: 'out-2', direction: 'outbound', channel: 'email', body: 'Sent details', ts: '2026-06-29T12:00:00.000Z', sender: 'You' },
  ];
}

describe('Conversation domain', () => {
  const lead = {
    row_number: 18,
    name: 'Reply Lead',
    email: 'lead@example.com',
    phone: '2075550100',
    sms_reply: 'Need help',
    email_reply: '',
    ownership: {
      organizationId: 'org_green_shield',
      ownerUserId: 'user_ah',
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
      source: 'store',
    },
  };

  it('classifies unread and read conversations without changing message sync semantics', () => {
    const unreadConversation = Conversation.fromMessages([
      { id: 'in-1', direction: 'inbound', channel: 'sms', body: 'Need help', ts: '2026-06-29T11:00:00.000Z' },
    ], {
      lastReadAt: '2026-06-29T10:00:00.000Z',
      readInboundKeys: [],
      lastReadInboundKey: null,
    }, lead);

    const readConversation = Conversation.fromMessages([
      { id: 'in-1', direction: 'inbound', channel: 'sms', body: 'Need help', ts: '2026-06-29T11:00:00.000Z' },
    ], {
      lastReadAt: '2026-06-29T12:00:00.000Z',
      readInboundKeys: ['sms|2026-06-29T11:00:00.000Z|Need help'],
      lastReadInboundKey: 'sms|2026-06-29T11:00:00.000Z|Need help',
    }, lead);

    expect(unreadConversation.isUnread()).toBe(true);
    expect(unreadConversation.computedStatus()).toBe('unread');
    expect(readConversation.isUnread()).toBe(false);
  });

  it('detects sms-only, email-only, and mixed conversations', () => {
    const smsOnly = Conversation.fromMessages([
      { id: 'sms-1', direction: 'inbound', channel: 'sms', body: 'SMS reply', ts: '2026-06-29T11:00:00.000Z' },
    ], {}, lead);
    const emailOnly = Conversation.fromMessages([
      { id: 'email-1', direction: 'inbound', channel: 'email', body: 'Email reply', ts: '2026-06-29T11:00:00.000Z' },
    ], {}, { ...lead, sms_reply: '', email_reply: 'Email reply' });
    const mixed = Conversation.fromMessages(buildMessages(), {}, { ...lead, email_reply: 'Email reply' });

    expect(smsOnly.channel()).toBe('sms');
    expect(smsOnly.hasSms()).toBe(true);
    expect(smsOnly.hasEmail()).toBe(false);

    expect(emailOnly.channel()).toBe('email');
    expect(emailOnly.hasSms()).toBe(false);
    expect(emailOnly.hasEmail()).toBe(true);

    expect(mixed.channel()).toBe('mixed');
    expect(mixed.hasSms()).toBe(true);
    expect(mixed.hasEmail()).toBe(true);
  });

  it('returns preview, summary, counts, and activity timestamps', () => {
    const conversation = Conversation.fromMessages(buildMessages(), {
      preview: 'Need help',
      lastReadAt: '2026-06-29T11:30:00.000Z',
      readInboundKeys: ['sms|2026-06-29T11:00:00.000Z|Need help'],
      lastReadInboundKey: 'sms|2026-06-29T11:00:00.000Z|Need help',
    }, lead);

    expect(conversation.preview()).toBe('Need help');
    expect(conversation.lastInbound()?.body).toBe('Need help');
    expect(conversation.lastOutbound()?.body).toBe('Sent details');
    expect(conversation.latestCustomerMessage()?.body).toBe('Need help');
    expect(conversation.latestAgentMessage()?.body).toBe('Sent details');
    expect(conversation.firstActivityAt()).toBe('2026-06-29T10:00:00.000Z');
    expect(conversation.lastActivityAt()).toBe('2026-06-29T12:00:00.000Z');
    expect(conversation.messageCount()).toBe(3);
    expect(conversation.inboundCount()).toBe(1);
    expect(conversation.outboundCount()).toBe(2);
    expect(conversation.summary()).toMatchObject({
      preview: 'Need help',
      lastAt: '2026-06-29T12:00:00.000Z',
      messageCount: 3,
      inboundCount: 1,
      outboundCount: 2,
      channel: 'mixed',
      unread: false,
    });
  });

  it('calculates reply state, waiting state, and response timing', () => {
    const requiresReply = Conversation.fromMessages([
      { id: 'in-1', direction: 'inbound', channel: 'sms', body: 'Need help', ts: '2026-06-29T11:00:00.000Z' },
    ], {}, lead);
    const waitingOnCustomer = Conversation.fromMessages([
      { id: 'in-1', direction: 'inbound', channel: 'sms', body: 'Need help', ts: '2026-06-29T11:00:00.000Z' },
      { id: 'out-1', direction: 'outbound', channel: 'sms', body: 'We can help', ts: '2026-06-29T12:00:00.000Z' },
    ], {}, lead);

    expect(requiresReply.requiresReply()).toBe(true);
    expect(requiresReply.customerWaiting()).toBe(false);
    expect(requiresReply.computedStatus()).toBe('unread');
    expect(waitingOnCustomer.requiresReply()).toBe(false);
    expect(waitingOnCustomer.customerWaiting()).toBe(true);
    expect(waitingOnCustomer.computedStatus()).toBe('unread');

    const responseTime = waitingOnCustomer.responseTime();
    expect(responseTime).toMatchObject({
      ms: 60 * 60 * 1000,
      awaitingReply: false,
      waitingOnCustomer: true,
      from: 'customer',
      to: 'agent',
    });
  });

  it('preserves backward compatibility through toJSON', () => {
    const conversation = Conversation.fromMessages(buildMessages(), {
      preview: 'Need help',
      lastReadAt: '2026-06-29T11:30:00.000Z',
      lastReadInboundKey: 'sms|2026-06-29T11:00:00.000Z|Need help',
      readInboundKeys: ['sms|2026-06-29T11:00:00.000Z|Need help'],
    }, lead);

    const json = conversation.toJSON();
    expect(json).toMatchObject({
      lead: expect.objectContaining({
        row_number: 18,
        name: 'Reply Lead',
      }),
      channel: 'mixed',
      preview: 'Need help',
      unread: false,
      messageCount: 3,
      inboundCount: 1,
      outboundCount: 2,
      displayStatus: 'Waiting on Customer',
      computedStatus: 'waiting_on_customer',
    });
    expect(Array.isArray(json.messages)).toBe(true);
    expect(Array.isArray(json.attachments)).toBe(true);
    expect(Array.isArray(json.tags)).toBe(true);
  });
});
