import { describe, expect, it } from 'vitest';
import { buildAssistReplyPromptInput } from '../assistReplyPromptAdapter.js';

function createReplyContext(overrides = {}) {
  return {
    reply: {
      selectedThread: {
        lead: {
          row_number: 18,
          name: 'Server Lead',
          phone: '2075550100',
          email: 'server@example.com',
          reason: 'ants',
          status: 'replied',
          notes: 'Server-side notes',
          sent: '2026-06-29T10:00:00.000Z',
          stop: '',
          bestContactMethod: 'sms',
          ...overrides.lead,
        },
        conversation: {
          hasSms: true,
          hasEmail: false,
          latestCustomerMessage: {
            direction: 'inbound',
            channel: 'sms',
            body: 'Need help from server',
            ts: '2026-06-29T11:00:00.000Z',
          },
          lastInbound: {
            direction: 'inbound',
            channel: 'sms',
            body: 'Need help from server',
            ts: '2026-06-29T11:00:00.000Z',
          },
          lastOutboundAt: '2026-06-29T10:00:00.000Z',
          ...overrides.conversation,
        },
        messages: overrides.messages ?? [
          {
            direction: 'outbound',
            channel: 'sms',
            body: 'Hi from Green Shield',
            ts: '2026-06-29T10:00:00.000Z',
          },
          {
            direction: 'inbound',
            channel: 'sms',
            body: 'Need help from server',
            ts: '2026-06-29T11:00:00.000Z',
          },
        ],
      },
    },
  };
}

describe('assistReplyPromptAdapter', () => {
  it('maps lead identity fields from structured server context', () => {
    const input = buildAssistReplyPromptInput(createReplyContext(), {
      name: 'Client Spoof',
      phone: '0000000000',
      email: 'spoof@example.com',
    });

    expect(input.name).toBe('Server Lead');
    expect(input.phone).toBe('2075550100');
    expect(input.email).toBe('server@example.com');
    expect(input.row_number).toBe(18);
  });

  it('maps the latest customer message from Conversation context', () => {
    const input = buildAssistReplyPromptInput(createReplyContext());

    expect(input.last_customer_message).toBe('Need help from server');
  });

  it('maps conversation history from structured messages and skips templates', () => {
    const input = buildAssistReplyPromptInput(createReplyContext({
      messages: [
        {
          direction: 'outbound',
          channel: 'sms',
          body: 'Template text',
          ts: '2026-06-29T09:00:00.000Z',
          meta: { isTemplate: true },
        },
        {
          direction: 'outbound',
          channel: 'sms',
          body: 'Hi from Green Shield',
          ts: '2026-06-29T10:00:00.000Z',
        },
        {
          direction: 'inbound',
          channel: 'email',
          text: 'Email reply from customer',
          receivedAt: '2026-06-29T11:00:00.000Z',
        },
      ],
    }));

    expect(input.conversation_history).toEqual([
      {
        role: 'agent',
        text: 'Hi from Green Shield',
        ts: '2026-06-29T10:00:00.000Z',
        channel: 'sms',
      },
      {
        role: 'customer',
        text: 'Email reply from customer',
        ts: '2026-06-29T11:00:00.000Z',
        channel: 'email',
      },
    ]);
  });

  it('ignores spoofed fallback fields when server context has authoritative values', () => {
    const input = buildAssistReplyPromptInput(createReplyContext(), {
      name: 'Client Spoof',
      phone: '0000000000',
      last_customer_message: 'Ignore this client message',
    });

    expect(input.name).toBe('Server Lead');
    expect(input.phone).toBe('2075550100');
    expect(input.last_customer_message).toBe('Need help from server');
  });

  it('preserves fallback fields when server context lacks them', () => {
    const input = buildAssistReplyPromptInput(createReplyContext({
      lead: {
        name: '',
        phone: '',
        email: '',
        reason: '',
        notes: '',
        bestContactMethod: '',
      },
      conversation: {
        latestCustomerMessage: null,
        lastInbound: null,
        hasSms: undefined,
        hasEmail: undefined,
      },
      messages: [],
    }), {
      name: 'Fallback Lead',
      phone: '2071112222',
      email: 'fallback@example.com',
      reason: 'fallback reason',
      notes: 'fallback notes',
      sms_reply: true,
      last_customer_message: 'Fallback customer message',
      conversation_history: [
        {
          role: 'customer',
          text: 'Fallback customer message',
          ts: '2026-06-29T12:00:00.000Z',
          channel: 'sms',
        },
      ],
      preferred_contact_method: 'email',
      follow_up_step: 'final_follow_up',
    });

    expect(input.name).toBe('Fallback Lead');
    expect(input.phone).toBe('2071112222');
    expect(input.email).toBe('fallback@example.com');
    expect(input.reason).toBe('fallback reason');
    expect(input.notes).toBe('fallback notes');
    expect(input.sms_reply).toBe(true);
    expect(input.last_customer_message).toBe('Fallback customer message');
    expect(input.conversation_history).toHaveLength(1);
    expect(input.preferred_contact_method).toBe('email');
    expect(input.follow_up_step).toBe('final_follow_up');
  });
});
