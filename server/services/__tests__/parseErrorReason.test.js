import { describe, expect, it } from 'vitest';
import {
  calculateContractValue,
  classifyAndParseReason,
  enrichErrorItem,
  extractPaymentType,
  extractServiceAbbreviation,
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
    expect(result.detectedErrorType).toBe('Unpaid Initial Service');
    expect(result.price).toBe('$449');
    expect(result.paymentType).toBe('IS');
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
    expect(result.detectedErrorType).toBe('Unpaid Initial Service');
    expect(result.paymentType).toBe('IS');
    expect(result.contractValue).toBe(1048);
    expect(result.contractValueLabel).toBe('$1,048');
    expect(result.originalPriceLabel).toBe('$399 IS');
  });

  it('parses Column G OTS notes as full contract value', () => {
    const result = parseActivityErrorFields({
      notes: '$399 OTS',
      reason: '',
    });
    expect(result.paymentType).toBe('OTS');
    expect(result.category).toBe('pending');
    expect(result.detectedErrorType).toBe('One-Time Service');
    expect(result.contractValue).toBe(399);
    expect(result.contractValueLabel).toBe('$399');
    expect(result.originalPriceLabel).toBe('$399 OTS');
  });

  it('classifies unpaid OTS from Column F reason', () => {
    const result = parseActivityErrorFields({
      notes: '$399',
      reason: 'UNPAID OTS',
    });
    expect(result.detectedErrorType).toBe('Unpaid One-Time Service');
    expect(result.paymentType).toBe('OTS');
    expect(result.contractValue).toBe(399);
  });

  it('uses RIT default contract value when unpaid with no price', () => {
    const result = parseActivityErrorFields({
      notes: 'RIT',
      reason: 'UNPAID IS',
    });
    expect(result.serviceAbbreviation).toBe('RIT');
    expect(result.detectedServiceType).toBe('RIT');
    expect(result.detectedErrorType).toBe('Unpaid Initial Service');
    expect(result.contractValue).toBe(1164);
    expect(result.isEstimated).toBe(true);
  });

  it('uses IQ default contract value when unpaid with no price', () => {
    const result = parseActivityErrorFields({
      notes: 'IQ',
      reason: 'UNPAID IS',
    });
    expect(result.contractValue).toBe(1048);
    expect(result.isEstimated).toBe(true);
  });

  it('uses BB default contract value when unpaid with no price', () => {
    const result = parseActivityErrorFields({
      notes: 'Bed Bugs',
      reason: 'UNPAID IS',
    });
    expect(result.serviceAbbreviation).toBe('BB');
    expect(result.contractValue).toBe(1164);
  });

  it('calculates TMM contract value as price × 6', () => {
    const examples = [
      { notes: '$139 TMM', expected: 834 },
      { notes: '$169 TMM', expected: 1014 },
      { notes: '$199 TMM', expected: 1194 },
    ];

    for (const { notes, expected } of examples) {
      const result = parseActivityErrorFields({ notes, reason: '' });
      expect(result.detectedServiceType).toBe('TMM');
      expect(result.contractValue).toBe(expected);
      expect(result.contractValueLabel).toBe(`$${expected.toLocaleString('en-US')}`);
      expect(result.originalPriceLabel).toBe(notes);
    }
  });

  it('defaults unpaid TMM without price to $774', () => {
    const result = parseActivityErrorFields({
      notes: 'TMM',
      reason: 'UNPAID IS',
    });
    expect(result.detectedServiceType).toBe('TMM');
    expect(result.detectedErrorType).toBe('Unpaid Initial Service');
    expect(result.contractValue).toBe(774);
    expect(result.isEstimated).toBe(true);
  });

  it('prioritizes TMM price over IS when TMM is present', () => {
    const result = calculateContractValue({
      price: '$139',
      paymentType: 'IS',
      serviceAbbreviation: 'TMM',
      notesText: '$139 TMM',
      reasonText: '',
    });
    expect(result.contractValue).toBe(834);
    expect(result.serviceType).toBe('TMM');
  });

  it('uses unlabeled $449 and $399 fallback contract values', () => {
    expect(parseActivityErrorFields({ notes: '5/22 $449', reason: '' })).toMatchObject({
      contractValue: 1164,
      contractValueLabel: '$1,164',
    });
    expect(parseActivityErrorFields({ notes: '6/1 $399', reason: '' })).toMatchObject({
      contractValue: 1048,
      contractValueLabel: '$1,048',
    });
  });

  it('falls back to reason when notes are empty', () => {
    const result = parseActivityErrorFields({
      notes: '',
      reason: 'UNPAID IS/OTS 6/1 $399',
    });
    expect(result.category).toBe('unpaid');
    expect(result.detectedErrorType).toBe('Unpaid Initial Service');
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
    expect(result.detectedErrorType).toBe('OTS Pending');
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

  it('extracts payment and service abbreviations', () => {
    expect(extractPaymentType('5/22 $449 IS')).toBe('IS');
    expect(extractPaymentType('$399 OTS')).toBe('OTS');
    expect(extractServiceAbbreviation('$139 TMM')).toBe('TMM');
    expect(extractServiceAbbreviation('RIT')).toBe('RIT');
    expect(extractServiceType('$139 TMM')).toBe('TMM');
  });

  it('builds card summary from enrichment', () => {
    const item = enrichErrorItem({
      customerName: 'SRA Varieties',
      customerId: '27194',
      reason: 'UNPAID IS',
      notes: 'RIT',
      dashboardStatus: 'open',
    });
    expect(item.cardSummary).toBe('Customer 27194 — Unpaid Initial Service — RIT — $1,164');
    expect(item.contractValue).toBe(1164);
    expect(item.isComplete).toBe(false);
  });

  it('keeps classifyAndParseReason compatibility', () => {
    const result = classifyAndParseReason('UNPAID IS/OTS 5/22 $499');
    expect(result.category).toBe('unpaid');
    expect(result.detectedErrorType).toBe('Unpaid Initial Service');
    expect(result.price).toBe('$499');
    expect(result.contractValueLabel).toBe('No contract value found');
  });
});
