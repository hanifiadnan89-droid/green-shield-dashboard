import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateAgreementSchedule,
  formatAgreementMonthLabel,
  parseAgreementDate,
  resolveAgreementStartDate,
} from '../agreementSchedule.js';
import { getAgreementScheduleConfig } from '../agreementScheduleConfig.js';
import { applyAgreementScheduleToPdf } from '../applyAgreementScheduleToPdf.js';

describe('generateAgreementSchedule month labels', () => {
  it('generates 12 months from January', () => {
    const { scheduleMonths } = generateAgreementSchedule({
      agreementType: 'insect_quarterly',
      startDate: '2026-01-15',
      initialPayment: 399,
      recurringPayment: 59,
    });
    expect(scheduleMonths).toHaveLength(12);
    expect(scheduleMonths[0].label).toBe("Jan '26");
    expect(scheduleMonths[11].label).toBe("Dec '26");
  });

  it('generates 12 months from June', () => {
    const { scheduleMonths } = generateAgreementSchedule({
      agreementType: 'insect_quarterly',
      startDate: '2026-06-15',
      initialPayment: 399,
      recurringPayment: 59,
    });
    expect(scheduleMonths[0].label).toBe("Jun '26");
    expect(scheduleMonths[11].label).toBe("May '27");
  });

  it('generates 12 months from December with year rollover', () => {
    const { scheduleMonths } = generateAgreementSchedule({
      agreementType: 'insect_quarterly',
      startDate: '2026-12-01',
      initialPayment: 399,
      recurringPayment: 59,
    });
    expect(scheduleMonths[0].label).toBe("Dec '26");
    expect(scheduleMonths[1].label).toBe("Jan '27");
    expect(scheduleMonths[11].label).toBe("Nov '27");
  });
});

describe('generateAgreementSchedule service markers', () => {
  it('marks quarterly months 0, 3, 6, 9 for IQ', () => {
    const { scheduleMonths } = generateAgreementSchedule({
      agreementType: 'insect_quarterly',
      startDate: '2026-06-15',
      initialPayment: 399,
      recurringPayment: 59,
    });
    const serviceIndexes = scheduleMonths.filter(m => m.isServiceMonth).map(m => m.index);
    expect(serviceIndexes).toEqual([0, 3, 6, 9]);
  });

  it('marks triannual months 0, 1, 4, 8 for RIT including one-month follow-up', () => {
    const { scheduleMonths } = generateAgreementSchedule({
      agreementType: 'rodent_insect_triannual',
      startDate: '2026-06-15',
      initialPayment: 449,
      recurringPayment: 65,
    });
    const serviceIndexes = scheduleMonths.filter(m => m.isServiceMonth).map(m => m.index);
    expect(serviceIndexes).toEqual([0, 1, 4, 8]);
    expect(scheduleMonths[1].label).toBe("Jul '26");
    expect(scheduleMonths[1].serviceMarker).toBe('S');
  });

  it('marks every month for commercial monthly', () => {
    const { scheduleMonths } = generateAgreementSchedule({
      agreementType: 'commercial_monthly',
      startDate: '2026-03-01',
      initialPayment: 600,
      recurringPayment: 300,
    });
    expect(scheduleMonths.every(m => m.isServiceMonth)).toBe(true);
  });

  it('marks seasonal months for Tick & Mosquito', () => {
    const { scheduleMonths } = generateAgreementSchedule({
      agreementType: 'tick_mosquito_monthly',
      startDate: '2026-01-15',
      initialPayment: 129,
      recurringPayment: 129,
    });
    const serviceMonths = scheduleMonths
      .filter(m => m.isServiceMonth)
      .map(m => m.month);
    expect(serviceMonths).toEqual([4, 5, 6, 7, 8, 9]);
  });
});

describe('generateAgreementSchedule payments and edge cases', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses bed bug initial payment template with service marker style', () => {
    const { scheduleMonths } = generateAgreementSchedule({
      agreementType: 'bed_bug_insect_triannual',
      startDate: '2026-06-15',
      initialPayment: 599,
      recurringPayment: 65,
    });
    expect(scheduleMonths[0].paymentText).toBe('2x(S)599.00');
    expect(scheduleMonths[1].paymentText).toBe('$65.00');
    expect(scheduleMonths[0].serviceMarker).toBe('S');
  });

  it('uses fallback start date when missing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:00:00'));
    const result = generateAgreementSchedule({
      agreementType: 'insect_quarterly',
      initialPayment: 399,
      recurringPayment: 59,
    });
    expect(result.usedFallback).toBe(true);
    expect(result.scheduleMonths[0].label).toBe("Aug '26");
    expect(result.warning).toMatch(/today/i);
  });

  it('does not crash on invalid start date', () => {
    const resolved = resolveAgreementStartDate({ startDate: 'not-a-date' });
    expect(resolved.usedFallback).toBe(true);
    expect(() => generateAgreementSchedule({
      agreementType: 'insect_quarterly',
      startDate: 'not-a-date',
      initialPayment: 100,
      recurringPayment: 50,
    })).not.toThrow();
  });

  it('calculates contract start and end dates', () => {
    const result = generateAgreementSchedule({
      agreementType: 'insect_quarterly',
      startDate: '2026-06-15',
      initialPayment: 399,
      recurringPayment: 59,
    });
    expect(result.contractStartDate.getFullYear()).toBe(2026);
    expect(result.contractStartDate.getMonth()).toBe(5);
    expect(result.contractEndDate.getFullYear()).toBe(2027);
    expect(result.contractEndDate.getMonth()).toBe(4);
  });
});

describe('agreement schedule config', () => {
  it('exposes configs for all document agreement types', () => {
    const types = [
      'insect_quarterly',
      'rodent_insect_triannual',
      'bed_bug_insect_triannual',
      'tick_mosquito_monthly',
      'commercial_monthly',
      'commercial_bimonthly',
    ];
    for (const type of types) {
      expect(getAgreementScheduleConfig(type)).toBeTruthy();
    }
  });
});

describe('applyAgreementScheduleToPdf', () => {
  it('fills month and payment fields dynamically', () => {
    const filled = {};
    const fill = (name, value) => { filled[name] = value; };

    applyAgreementScheduleToPdf({
      prefix: 'insect_quarterly',
      agreementType: 'insect_quarterly',
      pricing: { initial: 399, discounted: 0, recurring: 59 },
      startDate: '2026-06-15',
      fill,
    });

    expect(filled.month_1).toBe("Jun '26");
    expect(filled.month_12).toBe("May '27");
    expect(filled.payment_1).toBe('$399.00');
    expect(filled.payment_2).toBe('$59.00');
    expect(filled.service_1).toBe('S');
    expect(filled.contract_start_date).toBeTruthy();
    expect(filled.contract_end_date).toBeTruthy();
  });
});

describe('parseAgreementDate', () => {
  it('parses ISO date strings', () => {
    const d = parseAgreementDate('2026-06-15');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(5);
  });

  it('formats month labels consistently', () => {
    expect(formatAgreementMonthLabel(new Date(2026, 5, 15))).toBe("Jun '26");
  });
});
