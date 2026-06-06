import { describe, expect, it } from 'vitest';
import { classifyAndParseReason, enrichErrorItem } from '../parseErrorReason.js';

describe('parseErrorReason', () => {
  it('parses unpaid initial with price', () => {
    const result = classifyAndParseReason('UNPAID IS/OTS 5/22 $499');
    expect(result.category).toBe('unpaid');
    expect(result.errorType).toBe('Unpaid Initial');
    expect(result.price).toBe('$499');
    expect(result.priceLabel).toBe('$499');
  });

  it('classifies line busy', () => {
    const result = classifyAndParseReason('LINE BUSY LVM');
    expect(result.category).toBe('line_busy');
    expect(result.priceLabel).toBe('No price listed');
  });

  it('builds floating title', () => {
    const item = enrichErrorItem({
      customerName: 'Sra Varieties',
      customerId: '27194',
      reason: 'UNPAID IS/OTS $499',
      notes: '',
      dashboardStatus: 'open',
    });
    expect(item.floatingTitle).toBe('Sra Varieties - Unpaid Initial - $499 - 27194');
  });
});
