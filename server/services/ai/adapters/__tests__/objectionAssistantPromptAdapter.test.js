import { describe, expect, it } from 'vitest';
import {
  buildObjectionAssistantContextOptions,
  buildObjectionAssistantPromptInput,
} from '../objectionAssistantPromptAdapter.js';

describe('objectionAssistantPromptAdapter', () => {
  it('builds sales-only context options when no rowNumber exists', () => {
    expect(buildObjectionAssistantContextOptions({
      context: { customerName: 'Unsaved Lead' },
      objection: 'Too expensive',
    })).toEqual({ type: 'sales' });
  });

  it('builds sales, lead, and conversation context options when rowNumber exists', () => {
    expect(buildObjectionAssistantContextOptions({
      context: { row_number: 42 },
      objection: 'Too expensive',
    })).toEqual({
      sections: ['sales', 'lead', 'conversation'],
      rowNumber: 42,
    });
  });

  it('preserves existing request fields without server lead context', () => {
    const input = buildObjectionAssistantPromptInput({ sales: { summary: {} } }, {
      context: {
        customerName: 'Jane',
        address: '123 Main St',
        serviceType: 'General Pest',
      },
      objection: 'Too expensive',
      action: 'shorten',
      existing_response: 'Current response',
    });

    expect(input).toEqual({
      context: {
        customerName: 'Jane',
        address: '123 Main St',
        serviceType: 'General Pest',
      },
      objection: 'Too expensive',
      action: 'shorten',
      existing_response: 'Current response',
    });
  });

  it('fills lead and conversation fields from server context when available', () => {
    const input = buildObjectionAssistantPromptInput({
      lead: {
        lead: {
          name: 'Server Lead',
          address: '456 Server Ave',
          propertyType: 'Single family',
          serviceType: 'Tick & Mosquito',
        },
      },
      conversation: {
        latestCustomerMessage: {
          body: 'Can you do any better on price?',
        },
      },
    }, {
      context: {},
      objection: 'Too expensive',
    });

    expect(input.context).toMatchObject({
      customerName: 'Server Lead',
      address: '456 Server Ave',
      propertyType: 'Single family',
      serviceType: 'Tick & Mosquito',
      previousMessage: 'Can you do any better on price?',
    });
    expect(input.objection).toBe('Too expensive');
  });

  it('does not allow client fallback to override server-resolved lead data', () => {
    const input = buildObjectionAssistantPromptInput({
      lead: {
        lead: {
          name: 'Server Lead',
          address: '456 Server Ave',
          propertyType: 'Single family',
        },
      },
    }, {
      context: {
        customerName: 'Client Spoof',
        address: '999 Fake St',
        propertyType: 'Fake type',
      },
      objection: 'Too expensive',
    });

    expect(input.context.customerName).toBe('Server Lead');
    expect(input.context.address).toBe('456 Server Ave');
    expect(input.context.propertyType).toBe('Single family');
  });
});
