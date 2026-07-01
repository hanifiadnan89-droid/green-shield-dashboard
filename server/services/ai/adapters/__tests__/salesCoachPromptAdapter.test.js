import { describe, expect, it } from 'vitest';
import {
  buildSalesCoachContextOptions,
  buildSalesCoachPromptInput,
} from '../salesCoachPromptAdapter.js';

describe('salesCoachPromptAdapter', () => {
  it('uses sales context only when no lead row is provided', () => {
    expect(buildSalesCoachContextOptions({
      situation: 'Customer says it is too expensive',
    })).toEqual({ type: 'sales' });
  });

  it('requests lead and conversation context when a lead row is provided', () => {
    expect(buildSalesCoachContextOptions({
      leadContext: { row_number: 22 },
    })).toEqual({
      sections: ['sales', 'lead', 'conversation'],
      rowNumber: 22,
    });
  });

  it('preserves existing prompt input fields without server lead context', () => {
    const input = buildSalesCoachPromptInput({ sales: { summary: {} } }, {
      situation: 'Too expensive',
      category: 'price',
      service: 'General Pest',
      personality: 'Analytical',
      propertyContext: { address: '123 Main St', notes: 'Large yard' },
      leadContext: { pricing: '$119/month', notes: 'Asked about guarantee' },
      sessionId: 'session-1',
    });

    expect(input).toMatchObject({
      situation: 'Too expensive',
      category: 'price',
      service: 'General Pest',
      personality: 'Analytical',
      propertyContext: { address: '123 Main St', notes: 'Large yard' },
      leadContext: { pricing: '$119/month', notes: 'Asked about guarantee' },
      sessionId: 'session-1',
    });
  });

  it('fills missing prompt input from AIContextBuilder lead and conversation context', () => {
    const input = buildSalesCoachPromptInput({
      lead: {
        lead: {
          name: 'Server Lead',
          address: '456 Server Ave',
          propertyType: 'Single family',
          notes: 'Server notes',
          pricing: '$399 initial',
          bestContactMethod: 'sms',
          displayStatus: 'Replied',
        },
      },
      conversation: {
        latestCustomerMessage: {
          body: 'Can you do any better on price?',
        },
      },
    }, {
      situation: 'Price objection',
      propertyContext: {},
      leadContext: {},
    });

    expect(input.propertyContext).toMatchObject({
      customerName: 'Server Lead',
      address: '456 Server Ave',
      propertyType: 'Single family',
    });
    expect(input.leadContext).toMatchObject({
      pricing: '$399 initial',
      notes: 'Server notes',
      leadNotes: 'Server notes',
      previousMessage: 'Can you do any better on price?',
      bestContactMethod: 'sms',
      status: 'Replied',
    });
  });

  it('uses server lead fields over client fallback when lead context exists', () => {
    const input = buildSalesCoachPromptInput({
      lead: {
        lead: {
          name: 'Server Lead',
          address: '456 Server Ave',
          notes: 'Server notes',
        },
      },
    }, {
      situation: 'Price objection',
      propertyContext: { customerName: 'Client Spoof', address: '999 Fake St' },
      leadContext: { notes: 'Client notes' },
    });

    expect(input.propertyContext.customerName).toBe('Server Lead');
    expect(input.propertyContext.address).toBe('456 Server Ave');
    expect(input.leadContext.notes).toBe('Server notes');
  });
});
