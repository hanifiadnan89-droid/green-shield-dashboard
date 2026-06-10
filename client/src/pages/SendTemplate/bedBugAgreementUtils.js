import { parseMoney } from './previewSendUtils.js';

function defaultAgreementDate(existing) {
  if (existing) return existing;
  return new Date().toISOString().slice(0, 10);
}

export function buildBedBugAgreementState(lead, address, pricing, agreementStartDate) {
  const initialQuote = pricing?.initial ?? '';
  const initialDiscount = pricing?.discounted ?? '';
  const subtotal = Math.max(0, parseMoney(initialQuote) - parseMoney(initialDiscount));
  const agreementDate = defaultAgreementDate(agreementStartDate);

  return {
    customerName: lead?.name ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    serviceAddress: address?.street ?? '',
    cityStateZip: address?.cityState ?? '',
    initialQuote,
    initialDiscount,
    initialSubtotal: subtotal ? String(subtotal) : '',
    tax: '0',
    initialTotal: subtotal ? String(subtotal) : '',
    recurringCharge: pricing?.recurring ?? '',
    recurringTax: '0',
    recurringTotal: pricing?.recurring ?? '',
    recurringPaymentAuthorized: pricing?.recurring ?? '',
    billingInfo: lead?.name ?? '',
    paymentMethod: '',
    cardLastFour: '',
    agreementDate,
    customerInitials: '',
    customerSignatureName: lead?.name ?? '',
    selectedAddOns: [],
  };
}

export function applyBedBugFormPatch(form, patch) {
  const next = { ...form, ...patch };
  const totals = computeBedBugTotals(next);
  return {
    ...next,
    initialSubtotal: String(totals.initialSubtotal),
    initialTotal: String(totals.initialTotal),
    recurringTotal: String(totals.recurringTotal),
    recurringPaymentAuthorized: next.recurringPaymentAuthorized
      ? next.recurringPaymentAuthorized
      : String(totals.recurringTotal),
  };
}

export function computeBedBugTotals(form) {
  const initialQuote = parseMoney(form.initialQuote);
  const initialDiscount = parseMoney(form.initialDiscount);
  const subtotal = Math.max(0, initialQuote - initialDiscount);
  const tax = parseMoney(form.tax);
  const initialTotal = subtotal + tax;
  const recurringCharge = parseMoney(form.recurringCharge);
  const recurringTax = parseMoney(form.recurringTax);
  const recurringTotal = recurringCharge + recurringTax;

  return {
    initialSubtotal: subtotal,
    initialTotal,
    recurringTotal,
    recurringPaymentAuthorized: parseMoney(form.recurringPaymentAuthorized) || recurringTotal,
  };
}

export function validateBedBugForm(form) {
  const errors = [];
  if (!String(form.customerName || '').trim()) errors.push('Customer name is required');
  if (!String(form.serviceAddress || '').trim()) errors.push('Service address is required');
  if (!String(form.initialQuote || '').trim()) errors.push('Initial quote is required');
  if (!String(form.initialTotal || '').trim()) errors.push('Initial total is required');
  if (!String(form.recurringCharge || '').trim()) errors.push('Recurring charge is required');
  if (!String(form.agreementDate || '').trim()) errors.push('Agreement date is required');
  return errors;
}

export function bedBugFormFingerprint(form, pricing, address, agreementStartDate) {
  return JSON.stringify({ form, pricing, address, agreementStartDate });
}

export function mergeBedBugPayload(basePayload, bedBugForm) {
  const totals = computeBedBugTotals(bedBugForm);
  return {
    ...basePayload,
    lead: {
      name: bedBugForm.customerName,
      email: bedBugForm.email,
      phone: bedBugForm.phone,
    },
    address: {
      street: bedBugForm.serviceAddress,
      cityState: bedBugForm.cityStateZip,
    },
    pricing: {
      initial: bedBugForm.initialQuote,
      discounted: bedBugForm.initialDiscount,
      recurring: bedBugForm.recurringCharge,
    },
    agreementStartDate: bedBugForm.agreementDate || basePayload.agreementStartDate,
    startDate: bedBugForm.agreementDate || basePayload.startDate,
    bedBugAgreement: {
      ...bedBugForm,
      initialSubtotal: String(totals.initialSubtotal),
      initialTotal: String(totals.initialTotal),
      recurringTotal: String(totals.recurringTotal),
      recurringPaymentAuthorized: String(totals.recurringPaymentAuthorized),
    },
    cardLastFour: bedBugForm.cardLastFour,
  };
}
