import { describe, it, expect } from 'vitest';
import {
  BED_BUG_INITIAL_PAYMENT_TEXT_TEMPLATE,
  BED_BUG_RECURRING_PAYMENT_TEXT_TEMPLATE,
  BED_BUG_SERVICE_INTERVAL_MONTHS,
  BED_BUG_SERVICE_MONTH_INDEXES,
} from '../bedBugScheduleConfig.js';
import { getAgreementScheduleConfig } from '../agreementScheduleConfig.js';

describe('bedBugScheduleConfig', () => {
  it('hard-codes initial month as 2x(S) with follow-ups every four months', () => {
    expect(BED_BUG_SERVICE_MONTH_INDEXES).toEqual([0, 4, 8]);
    expect(BED_BUG_SERVICE_INTERVAL_MONTHS).toBe(4);
    expect(BED_BUG_INITIAL_PAYMENT_TEXT_TEMPLATE).toBe('2x(S){initialTotal}');
    expect(BED_BUG_RECURRING_PAYMENT_TEXT_TEMPLATE).toBe('{recurringTotalFormatted}');
  });

  it('wires bed bug schedule config from hard-coded constants', () => {
    const config = getAgreementScheduleConfig('bed_bug_insect_triannual');
    expect(config?.serviceMonthIndexes).toEqual([0, 4, 8]);
    expect(config?.serviceIntervalMonths).toBe(4);
    expect(config?.initialPaymentTextTemplate).toBe('2x(S){initialTotal}');
    expect(config?.recurringPaymentTextTemplate).toBe('{recurringTotalFormatted}');
  });
});
