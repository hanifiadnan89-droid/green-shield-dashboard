import { getAgreementScheduleConfig } from './agreementScheduleConfig.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @typedef {Object} AgreementScheduleConfig
 * @property {string} agreementType
 * @property {string} label
 * @property {number} contractMonths
 * @property {number} [serviceIntervalMonths]
 * @property {number[]} [serviceMonthIndexes]
 * @property {boolean} [seasonBased]
 * @property {number[]} [serviceCalendarMonths] 1-12
 * @property {boolean} [billOnlyOnServiceMonths]
 * @property {string} [serviceMarker]
 * @property {string} [initialPaymentTextTemplate]
 * @property {string} [recurringPaymentTextTemplate]
 * @property {string} [serviceRecurringPaymentTextTemplate]
 */

/**
 * @typedef {Object} AgreementScheduleMonth
 * @property {number} index
 * @property {string} label
 * @property {number} year
 * @property {number} month 1-12
 * @property {boolean} isServiceMonth
 * @property {boolean} isInitialMonth
 * @property {string} paymentText
 * @property {string | null} serviceMarker
 */

/**
 * @param {unknown} value
 * @returns {Date | null}
 */
export function parseAgreementDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  }
  const str = String(value).trim();
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : startOfDay(d);
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * @param {Date} date
 * @returns {string} e.g. Jun '26
 */
export function formatAgreementMonthLabel(date) {
  const month = MONTH_NAMES[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${month} '${year}`;
}

/**
 * @param {Date} date
 * @returns {string} MM/DD/YYYY
 */
export function formatContractDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

/**
 * @param {{
 *   agreementStartDate?: string | Date | null,
 *   serviceStartDate?: string | Date | null,
 *   initialServiceDate?: string | Date | null,
 *   selectedStartDate?: string | Date | null,
 *   startDate?: string | Date | null,
 * }} params
 */
export function resolveAgreementStartDate(params = {}) {
  const candidates = [
    params.agreementStartDate,
    params.serviceStartDate,
    params.initialServiceDate,
    params.selectedStartDate,
    params.startDate,
  ];

  for (const candidate of candidates) {
    const parsed = parseAgreementDate(candidate);
    if (parsed) {
      return { startDate: parsed, usedFallback: false, warning: null };
    }
  }

  return {
    startDate: startOfDay(new Date()),
    usedFallback: true,
    warning: 'No valid agreement start date provided; using today.',
  };
}

function addMonths(date, count) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return d;
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatCurrency(amount) {
  if (!amount || amount <= 0) return '';
  return `$${amount.toFixed(2)}`;
}

/**
 * @param {string} template
 * @param {{ initialTotal: number, recurringTotal: number, serviceMarker?: string }} amounts
 */
function applyPaymentTemplate(template, amounts) {
  const initialPlain = amounts.initialTotal > 0 ? amounts.initialTotal.toFixed(2) : '';
  const recurringPlain = amounts.recurringTotal > 0 ? amounts.recurringTotal.toFixed(2) : '';
  return template
    .replaceAll('{initialTotal}', initialPlain)
    .replaceAll('{recurringTotal}', recurringPlain)
    .replaceAll('{initialTotalFormatted}', formatCurrency(amounts.initialTotal))
    .replaceAll('{recurringTotalFormatted}', formatCurrency(amounts.recurringTotal))
    .replaceAll('{serviceMarker}', amounts.serviceMarker ?? 'S');
}

/**
 * @param {number} index
 * @param {number} calendarMonth 1-12
 * @param {AgreementScheduleConfig} config
 */
function isServiceMonthForIndex(index, calendarMonth, config) {
  if (config.seasonBased && Array.isArray(config.serviceCalendarMonths)) {
    return config.serviceCalendarMonths.includes(calendarMonth);
  }
  if (Array.isArray(config.serviceMonthIndexes)) {
    return config.serviceMonthIndexes.includes(index);
  }
  if (config.serviceIntervalMonths && config.serviceIntervalMonths > 0) {
    return index % config.serviceIntervalMonths === 0;
  }
  return false;
}

/**
 * @param {{
 *   startDate?: string | Date | null,
 *   agreementStartDate?: string | Date | null,
 *   serviceStartDate?: string | Date | null,
 *   initialServiceDate?: string | Date | null,
 *   selectedStartDate?: string | Date | null,
 *   contractMonths?: number,
 *   serviceIntervalMonths?: number,
 *   serviceFrequency?: string,
 *   initialPayment?: number,
 *   recurringPayment?: number,
 *   initialPaymentText?: string,
 *   recurringPaymentText?: string,
 *   serviceMarker?: string,
 *   agreementType?: string,
 * }} params
 */
export function generateAgreementSchedule(params = {}) {
  const config = getAgreementScheduleConfig(params.agreementType) ?? {
    agreementType: params.agreementType ?? 'generic',
    label: 'Agreement',
    contractMonths: params.contractMonths ?? 12,
    serviceIntervalMonths: params.serviceIntervalMonths ?? 3,
    serviceMonthIndexes: [0, 3, 6, 9],
    serviceMarker: params.serviceMarker ?? 'S',
    initialPaymentTextTemplate: '{initialTotalFormatted}',
    recurringPaymentTextTemplate: '{recurringTotalFormatted}',
  };

  const contractMonths = params.contractMonths ?? config.contractMonths ?? 12;
  const { startDate, usedFallback, warning } = resolveAgreementStartDate(params);
  const initialTotal = Math.max(0, Number(params.initialPayment) || 0);
  const recurringTotal = Math.max(0, Number(params.recurringPayment) || 0);
  const marker = params.serviceMarker ?? config.serviceMarker ?? 'S';

  const initialTemplate = params.initialPaymentText ?? config.initialPaymentTextTemplate ?? '{initialTotalFormatted}';
  const recurringTemplate = params.recurringPaymentText ?? config.recurringPaymentTextTemplate ?? '{recurringTotalFormatted}';

  /** @type {AgreementScheduleMonth[]} */
  const scheduleMonths = [];

  for (let index = 0; index < contractMonths; index++) {
    const monthDate = addMonths(startDate, index);
    const calendarMonth = monthDate.getMonth() + 1;
    const isInitialMonth = index === 0;
    const isServiceMonth = isServiceMonthForIndex(index, calendarMonth, config);

    let paymentText = '';
    const shouldBill = !config.billOnlyOnServiceMonths || isServiceMonth || isInitialMonth;

    if (shouldBill) {
      if (isInitialMonth && initialTotal > 0) {
        paymentText = applyPaymentTemplate(initialTemplate, {
          initialTotal,
          recurringTotal,
          serviceMarker: marker,
        });
      } else if (recurringTotal > 0) {
        const serviceRecurringTemplate = config.serviceRecurringPaymentTextTemplate;
        const template = isServiceMonth && serviceRecurringTemplate
          ? serviceRecurringTemplate
          : recurringTemplate;
        paymentText = applyPaymentTemplate(template, {
          initialTotal,
          recurringTotal,
          serviceMarker: marker,
        });
      }
    }

    scheduleMonths.push({
      index,
      label: formatAgreementMonthLabel(monthDate),
      year: monthDate.getFullYear(),
      month: calendarMonth,
      isServiceMonth,
      isInitialMonth,
      paymentText,
      serviceMarker: isServiceMonth ? marker : null,
    });
  }

  const contractStartDate = startDate;
  const lastMonthDate = addMonths(startDate, contractMonths - 1);
  const contractEndDate = endOfMonth(lastMonthDate);

  return {
    contractStartDate,
    contractEndDate,
    scheduleMonths,
    agreementType: config.agreementType,
    usedFallback,
    warning,
  };
}
