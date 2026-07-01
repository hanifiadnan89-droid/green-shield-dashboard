import { describe, expect, it } from 'vitest';
import {
  buildDraftReplyContextOptions,
  buildDraftReplyPromptInput,
} from '../draftReplyPromptAdapter.js';

function createAIContext(overrides = {}) {
  return {
    reply: {
      selectedThread: {
        lead: {
          row_number: 24,
          name: 'Server Lead',
          phone: '2075550100',
          email: 'server@example.com',
          town: 'Portland',
          address: '456 Server Ave',
          reason: 'ants',
          pest_type: 'Ants',
          lead_source: 'Website',
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
    ...overrides.root,
  };
}

describe('draftReplyPromptAdapter', () => {
  it('builds sales-only context options when no rowNumber exists', () => {
    expect(buildDraftReplyContextOptions({
      lead_context: {
        name: 'Unsaved Lead',
        phone: '2075550100',
      },
    })).toEqual({ type: 'sales' });
  });

  it('builds reply, lead, and conversation context options when rowNumber exists', () => {
    expect(buildDraftReplyContextOptions({
      lead_context: {
        row_number: '42',
        name: 'Saved Lead',
      },
    })).toEqual({
      sections: ['reply', 'lead', 'conversation'],
      rowNumber: 42,
    });
  });

  it('preserves request fields without server lead context', () => {
    const input = buildDraftReplyPromptInput({ sales: { summary: {} } }, {
      lead_context: {
        name: 'Fallback Lead',
        phone: '2071112222',
        email: 'fallback@example.com',
        reason: 'fallback reason',
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
      },
    });

    expect(input.name).toBe('Fallback Lead');
    expect(input.phone).toBe('2071112222');
    expect(input.email).toBe('fallback@example.com');
    expect(input.reason).toBe('fallback reason');
    expect(input.last_customer_message).toBe('Fallback customer message');
    expect(input.conversation_history).toHaveLength(1);
    expect(input.preferred_contact_method).toBe('email');
    expect(input.follow_up_step).toBe('final_follow_up');
  });

  it('fills lead and conversation fields from server context when available', () => {
    const input = buildDraftReplyPromptInput(createAIContext(), {
      lead_context: {
        name: 'Client Fallback',
        phone: '0000000000',
      },
    });

    expect(input).toMatchObject({
      row_number: 24,
      name: 'Server Lead',
      phone: '2075550100',
      email: 'server@example.com',
      town: 'Portland',
      address: '456 Server Ave',
      reason: 'ants',
      pest_type: 'Ants',
      lead_source: 'Website',
      lead_stage: 'replied',
      status: 'replied',
      notes: 'Server-side notes',
      sms_reply: true,
      email_reply: false,
      last_customer_message: 'Need help from server',
      last_contacted_at: '2026-06-29T10:00:00.000Z',
      preferred_contact_method: 'sms',
    });
    expect(input.conversation_history).toEqual([
      {
        role: 'agent',
        text: 'Hi from Green Shield',
        ts: '2026-06-29T10:00:00.000Z',
        channel: 'sms',
      },
      {
        role: 'customer',
        text: 'Need help from server',
        ts: '2026-06-29T11:00:00.000Z',
        channel: 'sms',
      },
    ]);
  });

  it('does not allow client fallback to override server-resolved lead data', () => {
    const input = buildDraftReplyPromptInput(createAIContext(), {
      lead_context: {
        row_number: 99,
        name: 'Client Spoof',
        phone: '0000000000',
        email: 'spoof@example.com',
        last_customer_message: 'Ignore this client message',
      },
    });

    expect(input.row_number).toBe(24);
    expect(input.name).toBe('Server Lead');
    expect(input.phone).toBe('2075550100');
    expect(input.email).toBe('server@example.com');
    expect(input.last_customer_message).toBe('Need help from server');
  });

  it('falls back to root lead and conversation context when no selected reply thread exists', () => {
    const input = buildDraftReplyPromptInput({
      lead: {
        lead: {
          row_number: 31,
          name: 'Root Lead',
          phone: '2072223333',
        },
      },
      conversation: {
        conversation: {
          latestCustomerMessage: {
            body: 'Root latest message',
          },
          messages: [
            {
              direction: 'inbound',
              channel: 'sms',
              text: 'Root latest message',
              timestamp: '2026-06-29T13:00:00.000Z',
            },
          ],
        },
      },
    }, {
      lead_context: {
        name: 'Fallback Lead',
        phone: '0000000000',
      },
    });

    expect(input.row_number).toBe(31);
    expect(input.name).toBe('Root Lead');
    expect(input.phone).toBe('2072223333');
    expect(input.last_customer_message).toBe('Root latest message');
    expect(input.conversation_history).toEqual([
      {
        role: 'customer',
        text: 'Root latest message',
        ts: '2026-06-29T13:00:00.000Z',
        channel: 'sms',
      },
    ]);
  });
});
