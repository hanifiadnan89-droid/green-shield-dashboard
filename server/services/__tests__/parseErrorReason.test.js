import { describe, expect, it } from 'vitest';
import {
  calculateContractValue,
  classifyAndParseReason,
  enrichErrorItem,
} from '../parseErrorReason.js';

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

  it('maps unpaid initial $449 to $1,164 contract value', () => {
    const result = calculateContractValue({
      category: 'unpaid',
      price: '$449',
      reasonRaw: 'UNPAID IS/OTS 5/22 $449',
    });
    expect(result.contractValue).toBe(1164);
    expect(result.contractValueLabel).toBe('$1,164');
    expect(result.originalPrice).toBe('$449');
  });

  it('maps unpaid initial $399 to $1,048 contract value', () => {
    const result = calculateContractValue({
      category: 'unpaid',
      price: '$399',
      reasonRaw: 'UNPAID IS/OTS 6/1 $399',
    });
    expect(result.contractValue).toBe(1048);
    expect(result.contractValueLabel).toBe('$1,048');
  });

  it('uses listed price for OTS-only items', () => {
    const parsed = classifyAndParseReason('$399 OTS');
    const result = calculateContractValue({
      category: parsed.category,
      price: parsed.price,
      reasonRaw: parsed.reasonRaw,
    });
    expect(result.contractValue).toBe(399);
    expect(result.contractValueLabel).toBe('$399');
  });

  it('uses listed price for pending OTS items', () => {
    const parsed = classifyAndParseReason('OTS Pending $399');
    const result = calculateContractValue({
      category: parsed.category,
      price: parsed.price,
      reasonRaw: parsed.reasonRaw,
    });
    expect(result.contractValue).toBe(399);
    expect(result.contractValueLabel).toBe('$399');
  });

  it('returns no contract value when price is missing', () => {
    const result = calculateContractValue({
      category: 'unpaid',
      price: null,
      reasonRaw: 'UNPAID IS/OTS',
    });
    expect(result.contractValue).toBeNull();
    expect(result.contractValueLabel).toBe('No price listed');
  });

  it('builds floating title with contract value', () => {
    const item = enrichErrorItem({
      customerName: 'SRA Varieties',
      customerId: '27194',
      reason: 'UNPAID IS/OTS 5/22 $449',
      notes: '',
      dashboardStatus: 'open',
    });
    expect(item.floatingTitle).toBe('SRA Varieties - Unpaid Initial - $1,164 - 27194');
    expect(item.contractValue).toBe(1164);
    expect(item.originalPriceLabel).toBe('$449');
    expect(item.isComplete).toBe(false);
  });
});
