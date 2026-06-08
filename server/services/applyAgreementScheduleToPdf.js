import {
  generateAgreementSchedule,
  formatContractDate,
} from './agreementSchedule.js';

/**
 * Apply generated schedule values to PDF field writers.
 *
 * @param {{
 *   prefix: string,
 *   agreementType: string,
 *   pricing: { initial?: number, discounted?: number, recurring?: number },
 *   startDate?: string | null,
 *   agreementStartDate?: string | null,
 *   serviceStartDate?: string | null,
 *   initialServiceDate?: string | null,
 *   selectedStartDate?: string | null,
 *   fill: (name: string, value: string) => void,
 * }} params
 */
export function applyAgreementScheduleToPdf({
  prefix,
  agreementType,
  pricing = {},
  startDate,
  agreementStartDate,
  serviceStartDate,
  initialServiceDate,
  selectedStartDate,
  fill,
}) {
  const initVal = Number(pricing.initial) || 0;
  const discVal = Number(pricing.discounted) || 0;
  const recurVal = Number(pricing.recurring) || 0;
  const subtotal = Math.max(0, initVal - discVal);

  if (subtotal <= 0 && recurVal <= 0) return null;

  const schedule = generateAgreementSchedule({
    agreementType,
    startDate,
    agreementStartDate,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
    initialPayment: subtotal,
    recurringPayment: recurVal,
  });

  for (const month of schedule.scheduleMonths) {
    const n = month.index + 1;
    fill(`month_${n}`, month.label);
    if (month.paymentText) fill(`payment_${n}`, month.paymentText);
    if (month.serviceMarker) fill(`service_${n}`, month.serviceMarker);
  }

  fill('contract_start_date', formatContractDate(schedule.contractStartDate));
  fill('contract_end_date', formatContractDate(schedule.contractEndDate));
  fill('agreement_start_date', formatContractDate(schedule.contractStartDate));
  fill('agreement_end_date', formatContractDate(schedule.contractEndDate));

  if (schedule.warning) {
    console.warn(`[documents] ${prefix}: ${schedule.warning}`);
  }

  return schedule;
}
