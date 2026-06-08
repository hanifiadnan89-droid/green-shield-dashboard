/**
 * Per-agreement schedule configuration.
 * Drives calendar months, service markers, and payment text templates.
 */

/** @typedef {import('./agreementSchedule.js').AgreementScheduleConfig} AgreementScheduleConfig */

/** @type {Record<string, AgreementScheduleConfig>} */
export const AGREEMENT_SCHEDULE_CONFIG = {
  insect_quarterly: {
    agreementType: 'insect_quarterly',
    label: 'Insect Quarterly',
    contractMonths: 12,
    serviceIntervalMonths: 3,
    serviceMonthIndexes: [0, 3, 6, 9],
    serviceMarker: 'S',
    initialPaymentTextTemplate: '{initialTotalFormatted}',
    recurringPaymentTextTemplate: '{recurringTotalFormatted}',
  },
  rodent_insect_triannual: {
    agreementType: 'rodent_insect_triannual',
    label: 'Rodent Insect Triannual',
    contractMonths: 12,
    serviceIntervalMonths: 4,
    serviceMonthIndexes: [0, 4, 8],
    serviceMarker: 'S',
    initialPaymentTextTemplate: '{initialTotalFormatted}',
    recurringPaymentTextTemplate: '{recurringTotalFormatted}',
  },
  bed_bug_insect_triannual: {
    agreementType: 'bed_bug_insect_triannual',
    label: 'Bed Bug & Insect Triannual',
    contractMonths: 12,
    serviceIntervalMonths: 4,
    serviceMonthIndexes: [0, 4, 8],
    serviceMarker: 'S',
    initialPaymentTextTemplate: '2x(S){initialTotal}',
    recurringPaymentTextTemplate: '{recurringTotalFormatted}',
  },
  tick_mosquito_monthly: {
    agreementType: 'tick_mosquito_monthly',
    label: 'Tick & Mosquito Monthly',
    contractMonths: 12,
    seasonBased: true,
    serviceCalendarMonths: [4, 5, 6, 7, 8, 9],
    serviceMarker: 'S',
    billOnlyOnServiceMonths: true,
    initialPaymentTextTemplate: '{initialTotalFormatted}',
    recurringPaymentTextTemplate: '{recurringTotalFormatted}',
  },
  commercial_monthly: {
    agreementType: 'commercial_monthly',
    label: 'Commercial Monthly',
    contractMonths: 12,
    serviceIntervalMonths: 1,
    serviceMonthIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    serviceMarker: 'S',
    initialPaymentTextTemplate: '{initialTotalFormatted}',
    recurringPaymentTextTemplate: '{recurringTotalFormatted}',
  },
  commercial_bimonthly: {
    agreementType: 'commercial_bimonthly',
    label: 'Commercial Bi-Monthly',
    contractMonths: 12,
    serviceIntervalMonths: 2,
    serviceMonthIndexes: [0, 2, 4, 6, 8, 10],
    serviceMarker: 'S',
    initialPaymentTextTemplate: '{initialTotalFormatted}',
    recurringPaymentTextTemplate: '{recurringTotalFormatted}',
  },
};

/**
 * @param {string} agreementType
 * @returns {AgreementScheduleConfig | null}
 */
export function getAgreementScheduleConfig(agreementType) {
  if (!agreementType) return null;
  return AGREEMENT_SCHEDULE_CONFIG[agreementType] ?? null;
}
