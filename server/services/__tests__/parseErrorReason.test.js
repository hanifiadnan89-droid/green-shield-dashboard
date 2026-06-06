import { describe, expect, it } from 'vitest';
import {
  calculateContractValue,
  classifyAndParseReason,
  enrichErrorItem,
  extractServiceType,
  parseActivityErrorFields,
} from '../parseErrorReason.js';

describe('parseErrorReason', () => {
  it('parses Column G notes with IS price', () => {
    const result = parseActivityErrorFields({
      notes: '5/22 $449 IS',
      reason: 'UNPAID IS/OTS',
    });
    expect(result.category).toBe('unpaid');
    expect(result.errorType).toBe('Unpaid Initial');
    expect(result.price).toBe('$449');
    expect(result.serviceType).toBe('IS');
    expect(result.originalPriceLabel).toBe('$449 IS');
    expect(result.contractValue).toBe(1164);
    expect(result.contractValueLabel).toBe('$1,164');
    expect(result.parsedFromNotes).toBe(true);
  });

  it('parses Column G notes with $399 IS', () => {
    const result = parseActivityErrorFields({
      notes: '6/1 $399 IS',
      reason: '',
    });
    expect(result.category).toBe('unpaid');
    expect(result.errorType).toBe('Unpaid Initial');
    expect(result.serviceType).toBe('IS');
    expect(result.contractValue).toBe(1048);
    expect(result.contractValueLabel).toBe('$1,048');
    expect(result.originalPriceLabel).toBe('$399 IS');
  });

  it('parses Column G OTS notes as full contract value', () => {
    const result = parseActivityErrorFields({
      notes: '$399 OTS',
      reason: '',
    });
    expect(result.serviceType).toBe('OTS');
    expect(result.category).toBe('pending');
    expect(result.errorType).toBe('OTS');
    expect(result.contractValue).toBe(399);
    expect(result.contractValueLabel).toBe('$399');
    expect(result.originalPriceLabel).toBe('$399 OTS');
  });

  it('falls back to reason when notes are empty', () => {
    const result = parseActivityErrorFields({
      notes: '',
      reason: 'UNPAID IS/OTS 6/1 $399',
    });
    expect(result.category).toBe('unpaid');
    expect(result.errorType).toBe('Unpaid Initial');
    expect(result.price).toBe('$399');
    expect(result.contractValue).toBe(1048);
    expect(result.parsedFromNotes).toBe(false);
  });

  it('classifies OTS pending from notes', () => {
    const result = parseActivityErrorFields({
      notes: 'OTS Pending $399',
      reason: '',
    });
    expect(result.category).toBe('pending');
    expect(result.errorType).toBe('OTS Pending');
    expect(result.contractValue).toBe(399);
  });

  it('classifies line busy from notes', () => {
    const result = parseActivityErrorFields({
      notes: 'LINE BUSY LVM',
      reason: 'Follow up',
    });
    expect(result.category).toBe('line_busy');
    expect(result.priceLabel).toBe('No price listed');
  });

  it('maps IS $449 to $1,164 contract value', () => {
    const result = calculateContractValue({
      price: '$449',
      serviceType: 'IS',
      category: 'unpaid',
    });
    expect(result.contractValue).toBe(1164);
    expect(result.contractValueLabel).toBe('$1,164');
    expect(result.originalPriceLabel).toBe('$449 IS');
  });

  it('maps IS $399 to $1,048 contract value', () => {
    const result = calculateContractValue({
      price: '$399',
      serviceType: 'IS',
      category: 'unpaid',
    });
    expect(result.contractValue).toBe(1048);
    expect(result.contractValueLabel).toBe('$1,048');
  });

  it('uses listed price for OTS service type', () => {
    const result = calculateContractValue({
      price: '$399',
      serviceType: 'OTS',
      category: 'pending',
    });
    expect(result.contractValue).toBe(399);
    expect(result.contractValueLabel).toBe('$399');
    expect(result.originalPriceLabel).toBe('$399 OTS');
  });

  it('returns no contract value when price is missing', () => {
    const result = calculateContractValue({
      price: null,
      serviceType: 'IS',
      category: 'unpaid',
    });
    expect(result.contractValue).toBeNull();
    expect(result.contractValueLabel).toBe('No price listed');
  });

  it('extracts service type from dated notes', () => {
    expect(extractServiceType('5/22 $449 IS')).toBe('IS');
    expect(extractServiceType('$399 OTS')).toBe('OTS');
  });

  it('builds floating title from notes-driven enrichment', () => {
    const item = enrichErrorItem({
      customerName: 'SRA Varieties',
      customerId: '27194',
      reason: 'UNPAID IS/OTS',
      notes: '5/22 $449 IS',
      dashboardStatus: 'open',
    });
    expect(item.floatingTitle).toBe('SRA Varieties - Unpaid Initial - $1,164 - 27194');
    expect(item.contractValue).toBe(1164);
    expect(item.originalPriceLabel).toBe('$449 IS');
    expect(item.isComplete).toBe(false);
  });

  it('keeps classifyAndParseReason compatibility', () => {
    const result = classifyAndParseReason('UNPAID IS/OTS 5/22 $499');
    expect(result.category).toBe('unpaid');
    expect(result.errorType).toBe('Unpaid Initial');
    expect(result.price).toBe('$499');
  });
});
