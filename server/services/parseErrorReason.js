export const ERROR_CATEGORIES = {
  unpaid: 'unpaid',
  pending: 'pending',
  line_busy: 'line_busy',
  invoice: 'invoice',
  other: 'other',
};

export const SERVICE_CATALOG = {
  BB: { code: 'BB', label: 'Bed Bugs', defaultContractValue: 1164 },
  IQ: { code: 'IQ', label: 'Insect Quarterly', defaultContractValue: 1048 },
  RIT: { code: 'RIT', label: 'Rodent/Insect Triannual', defaultContractValue: 1164 },
  TMM: {
    code: 'TMM',
    label: 'Tick & Mosquito',
    defaultPerTreatment: 129,
    defaultContractValue: 774,
  },
};

const IS_CONTRACT_VALUE_BY_PRICE = {
  449: 1164,
  399: 1048,
};

const NO_CONTRACT_VALUE_LABEL = 'No contract value found';
const TMM_TREATMENTS_PER_SEASON = 6;

export function parsePriceAmount(price) {
  if (!price) return null;
  const match = price.toString().match(/[\d,]+(?:\.\d{2})?/);
  if (!match) return null;
  const amount = Number.parseFloat(match[0].replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

export function formatUsd(amount) {
  if (!Number.isFinite(amount)) return null;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function extractPrice(text = '') {
  const match = text.toString().match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  return match ? `$${match[1].replace(/,/g, '')}` : null;
}

export function isTmmNotes(text = '') {
  return /\bTMM\b/i.test(text.toString())
    || /\bTICK\s*(?:&|AND)\s*MOSQUITO/i.test(text.toString());
}

export function extractServiceAbbreviation(text = '') {
  const raw = text.toString().trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  if (/\bBED\s*BUGS?\b/.test(upper) || /\bBB\b/.test(upper)) return 'BB';
  if (/\bINSECT\s+QUARTERLY\b/.test(upper) || /\bIQ\b/.test(upper)) return 'IQ';
  if (/\bRODENT\/INSECT\s+TRIANNUAL\b/.test(upper) || /\bRIT\b/.test(upper)) return 'RIT';
  if (isTmmNotes(raw)) return 'TMM';

  return null;
}

export function extractPaymentType(text = '') {
  const raw = text.toString().trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  if (/\bUNPAID\s+OTS\b/i.test(raw)) return 'OTS';
  if (/\bUNPAID\s+IS\b/i.test(raw)) return 'IS';

  const priceAdjacent = raw.match(/\$\s*[\d,]+(?:\.\d{2})?\s*(IS|OTS)\b/i);
  if (priceAdjacent) return priceAdjacent[1].toUpperCase();

  const datedPrice = raw.match(/\d{1,2}\/\d{1,2}\s+\$\s*[\d,]+(?:\.\d{2})?\s*(IS|OTS)\b/i);
  if (datedPrice) return datedPrice[1].toUpperCase();

  if (/\bOTS PENDING\b/i.test(raw) || (/\bPENDING\b/i.test(raw) && /\bOTS\b/.test(upper))) {
    return 'OTS';
  }

  if (/\bOTS\b/.test(upper) && !/\bIS\/OTS\b/.test(upper)) return 'OTS';

  if (/\bIS\b/.test(upper) && !/\bIS\/OTS\b/.test(upper)) return 'IS';

  return null;
}

/** @deprecated Use extractPaymentType */
export function extractServiceType(text = '') {
  const abbrev = extractServiceAbbreviation(text);
  if (abbrev === 'TMM') return 'TMM';
  return extractPaymentType(text);
}

export function resolveDetectedService({ paymentType, serviceAbbreviation } = {}) {
  if (serviceAbbreviation) return serviceAbbreviation;
  if (paymentType) return paymentType;
  return null;
}

export function getServiceLabel(code) {
  if (!code) return null;
  if (SERVICE_CATALOG[code]) return SERVICE_CATALOG[code].label;
  if (code === 'IS') return 'Initial Service';
  if (code === 'OTS') return 'One-Time Service';
  return code;
}

export function buildOriginalPriceLabel(price, detectedService, { isEstimated = false } = {}) {
  if (!price) {
    if (isEstimated && detectedService) return `${detectedService} (estimated)`;
    return 'No price listed';
  }
  if (detectedService) return `${price} ${detectedService}`;
  return price;
}

function hasUnpaidContext(combinedUpper) {
  return /\bUNPAID\b/.test(combinedUpper) || /\bIS\/OTS\b/.test(combinedUpper) || /\bINITIAL\b/.test(combinedUpper);
}

export function classifyErrorType({
  notesText = '',
  reasonText = '',
  paymentType = null,
  serviceAbbreviation = null,
} = {}) {
  const combined = `${reasonText} ${notesText}`.trim();
  const combinedUpper = combined.toUpperCase();
  const reasonUpper = reasonText.toUpperCase();

  if (/LINE BUSY|\bLVM\b|LEFT VOICEMAIL|VOICEMAIL/.test(combinedUpper)) {
    return {
      category: ERROR_CATEGORIES.line_busy,
      errorType: 'Line Busy',
      detectedErrorType: 'Line Busy',
      errorClass: 'other',
    };
  }

  if (/INVOICE|REQUESTED INVOICE/.test(combinedUpper)) {
    return {
      category: ERROR_CATEGORIES.invoice,
      errorType: 'Invoice',
      detectedErrorType: 'Invoice',
      errorClass: 'other',
    };
  }

  const hasUnpaid = /\bUNPAID\b/.test(combinedUpper);
  const hasPending = /\bPENDING\b/.test(combinedUpper);
  const reasonUnpaidOts = /\bUNPAID\s+OTS\b/i.test(reasonText);
  const reasonUnpaidIs = /\bUNPAID\s+IS\b|\bUNPAID\s+INITIAL\b/i.test(reasonText);
  const notesPayment = paymentType
    || extractPaymentType(notesText)
    || extractPaymentType(reasonText);
  const notesAbbrev = serviceAbbreviation
    || extractServiceAbbreviation(notesText)
    || extractServiceAbbreviation(reasonText);

  if (reasonUnpaidOts || (hasUnpaid && notesPayment === 'OTS')) {
    return {
      category: ERROR_CATEGORIES.unpaid,
      errorType: 'Unpaid One-Time Service',
      detectedErrorType: 'Unpaid One-Time Service',
      errorClass: 'unpaid_ots',
    };
  }

  if (
    reasonUnpaidIs
    || (hasUnpaid && notesPayment === 'IS')
    || (hasUnpaid && notesAbbrev && notesPayment !== 'OTS')
    || (notesPayment === 'IS' && hasUnpaidContext(combinedUpper))
    || (notesPayment === 'IS' && !hasPending)
  ) {
    return {
      category: ERROR_CATEGORIES.unpaid,
      errorType: 'Unpaid Initial Service',
      detectedErrorType: 'Unpaid Initial Service',
      errorClass: 'unpaid_is',
    };
  }

  if (hasUnpaid) {
    return {
      category: ERROR_CATEGORIES.unpaid,
      errorType: 'Missing Payment',
      detectedErrorType: 'Missing Payment',
      errorClass: 'missing_payment',
    };
  }

  if (hasPending && (notesPayment === 'OTS' || /\bOTS\b/.test(combinedUpper))) {
    return {
      category: ERROR_CATEGORIES.pending,
      errorType: 'OTS Pending',
      detectedErrorType: 'OTS Pending',
      errorClass: 'pending',
    };
  }

  if (hasPending && !hasUnpaid) {
    return {
      category: ERROR_CATEGORIES.pending,
      errorType: 'Pending',
      detectedErrorType: 'Pending',
      errorClass: 'pending',
    };
  }

  if (notesPayment === 'OTS') {
    return {
      category: ERROR_CATEGORIES.pending,
      errorType: 'One-Time Service',
      detectedErrorType: 'One-Time Service',
      errorClass: 'pending',
    };
  }

  if (/NO SALE/.test(combinedUpper)) {
    return {
      category: ERROR_CATEGORIES.other,
      errorType: 'No Sale',
      detectedErrorType: 'No Sale',
      errorClass: 'other',
    };
  }

  if (/SUBSCRIPTION/.test(combinedUpper)) {
    return {
      category: ERROR_CATEGORIES.other,
      errorType: 'Subscription',
      detectedErrorType: 'Subscription',
      errorClass: 'other',
    };
  }

  const source = reasonText || notesText;
  if (source) {
    const short = source.split(/\s{2,}|—|-/)[0].trim();
    const errorType = short.length > 42 ? `${short.slice(0, 39)}…` : short;
    return {
      category: ERROR_CATEGORIES.other,
      errorType,
      detectedErrorType: 'Other Account/Setup Error',
      errorClass: 'other',
    };
  }

  return {
    category: ERROR_CATEGORIES.other,
    errorType: 'Error',
    detectedErrorType: 'Other Account/Setup Error',
    errorClass: 'other',
  };
}

function applyServiceDefault(serviceAbbreviation, { isEstimated = true } = {}) {
  const catalog = SERVICE_CATALOG[serviceAbbreviation];
  if (!catalog?.defaultContractValue) return null;

  const label = serviceAbbreviation === 'TMM'
    ? `$${catalog.defaultPerTreatment} TMM (est.)`
    : `${serviceAbbreviation} (estimated)`;

  return {
    contractValue: catalog.defaultContractValue,
    contractValueLabel: formatUsd(catalog.defaultContractValue),
    originalPrice: null,
    originalPriceLabel: label,
    serviceType: serviceAbbreviation,
    isEstimated: isEstimated,
  };
}

export function calculateContractValue({
  price,
  paymentType = null,
  serviceAbbreviation = null,
  notesText = '',
  reasonText = '',
  hasUnpaid = false,
} = {}) {
  const combinedUpper = `${notesText} ${reasonText}`.toUpperCase();
  const unpaid = hasUnpaid || hasUnpaidContext(combinedUpper);
  const originalPrice = price || null;
  const priceAmount = parsePriceAmount(price);
  const abbrev = serviceAbbreviation;
  const payType = paymentType;
  const detectedService = resolveDetectedService({
    paymentType: payType,
    serviceAbbreviation: abbrev,
  });
  const originalPriceLabel = buildOriginalPriceLabel(price, detectedService);

  const fail = (resolvedService = detectedService) => ({
    contractValue: null,
    contractValueLabel: NO_CONTRACT_VALUE_LABEL,
    originalPrice,
    originalPriceLabel: buildOriginalPriceLabel(price, resolvedService),
    serviceType: resolvedService,
    isEstimated: false,
  });

  // 1. TMM with listed price → price × 6
  if (abbrev === 'TMM' && priceAmount != null) {
    const contractValue = priceAmount * TMM_TREATMENTS_PER_SEASON;
    return {
      contractValue,
      contractValueLabel: formatUsd(contractValue),
      originalPrice,
      originalPriceLabel: buildOriginalPriceLabel(price, 'TMM'),
      serviceType: 'TMM',
      isEstimated: false,
    };
  }

  // 2. OTS with listed price → listed price only
  if (payType === 'OTS' && priceAmount != null) {
    return {
      contractValue: priceAmount,
      contractValueLabel: formatUsd(priceAmount),
      originalPrice,
      originalPriceLabel: buildOriginalPriceLabel(price, 'OTS'),
      serviceType: 'OTS',
      isEstimated: false,
    };
  }

  // 3. IS $449 → $1,164
  if (payType === 'IS' && priceAmount === 449) {
    return {
      contractValue: IS_CONTRACT_VALUE_BY_PRICE[449],
      contractValueLabel: formatUsd(IS_CONTRACT_VALUE_BY_PRICE[449]),
      originalPrice,
      originalPriceLabel: buildOriginalPriceLabel(price, 'IS'),
      serviceType: 'IS',
      isEstimated: false,
    };
  }

  // 4. IS $399 → $1,048
  if (payType === 'IS' && priceAmount === 399) {
    return {
      contractValue: IS_CONTRACT_VALUE_BY_PRICE[399],
      contractValueLabel: formatUsd(IS_CONTRACT_VALUE_BY_PRICE[399]),
      originalPrice,
      originalPriceLabel: buildOriginalPriceLabel(price, 'IS'),
      serviceType: 'IS',
      isEstimated: false,
    };
  }

  // 5. No label but $449 → $1,164
  if (!payType && !abbrev && priceAmount === 449) {
    return {
      contractValue: IS_CONTRACT_VALUE_BY_PRICE[449],
      contractValueLabel: formatUsd(IS_CONTRACT_VALUE_BY_PRICE[449]),
      originalPrice,
      originalPriceLabel,
      serviceType: null,
      isEstimated: false,
    };
  }

  // 6. No label but $399 → $1,048
  if (!payType && !abbrev && priceAmount === 399) {
    return {
      contractValue: IS_CONTRACT_VALUE_BY_PRICE[399],
      contractValueLabel: formatUsd(IS_CONTRACT_VALUE_BY_PRICE[399]),
      originalPrice,
      originalPriceLabel,
      serviceType: null,
      isEstimated: false,
    };
  }

  // 7. TMM unpaid, no price → $774 default
  if (abbrev === 'TMM' && priceAmount == null && unpaid) {
    const estimated = applyServiceDefault('TMM');
    if (estimated) return estimated;
  }

  // 8–10. Service abbreviation defaults when unpaid / IS without price
  if (priceAmount == null && abbrev && abbrev !== 'TMM' && (unpaid || payType === 'IS')) {
    const estimated = applyServiceDefault(abbrev);
    if (estimated) return estimated;
  }

  if (priceAmount == null && payType === 'IS' && abbrev) {
    const estimated = applyServiceDefault(abbrev);
    if (estimated) return estimated;
  }

  if (priceAmount == null && payType === 'IS' && unpaid) {
    if (abbrev && SERVICE_CATALOG[abbrev]) {
      return applyServiceDefault(abbrev);
    }
  }

  return fail();
}

export function parseActivityErrorFields({ notes = '', reason = '' } = {}) {
  const notesText = (notes ?? '').toString().trim();
  const reasonText = (reason ?? '').toString().trim();
  const parsedFromNotes = Boolean(notesText);

  const price = extractPrice(notesText) || extractPrice(reasonText);
  const serviceAbbreviation = extractServiceAbbreviation(reasonText)
    || extractServiceAbbreviation(notesText);
  const paymentType = extractPaymentType(reasonText) || extractPaymentType(notesText);

  const classification = classifyErrorType({
    notesText,
    reasonText,
    paymentType,
    serviceAbbreviation,
  });

  const contract = calculateContractValue({
    price,
    paymentType,
    serviceAbbreviation,
    notesText,
    reasonText,
    hasUnpaid: classification.errorClass?.startsWith('unpaid'),
  });

  const detectedServiceType = serviceAbbreviation
    || paymentType
    || contract.serviceType
    || null;

  const detectedServiceLabel = getServiceLabel(detectedServiceType);
  const reasonDisplay = reasonText || notesText || '—';

  return {
    notesText,
    reasonRaw: reasonText,
    reasonText,
    reasonDisplay,
    parsedFromNotes,
    category: classification.category,
    errorType: classification.errorType,
    detectedErrorType: classification.detectedErrorType,
    errorClass: classification.errorClass,
    price,
    priceLabel: price || 'No price listed',
    paymentType,
    serviceAbbreviation,
    serviceType: detectedServiceType,
    detectedServiceType,
    detectedServiceLabel,
    sourceText: notesText || reasonText,
    cardSummary: buildCardSummary({
      customerId: null,
      detectedErrorType: classification.detectedErrorType,
      detectedServiceType,
      contractValueLabel: contract.contractValueLabel,
    }),
    ...contract,
  };
}

export function buildCardSummary({
  customerId,
  detectedErrorType,
  detectedServiceType,
  contractValueLabel,
}) {
  const parts = [];
  if (detectedErrorType) parts.push(detectedErrorType);
  if (detectedServiceType) parts.push(detectedServiceType);
  if (contractValueLabel && contractValueLabel !== NO_CONTRACT_VALUE_LABEL) {
    parts.push(contractValueLabel);
  }
  const summary = parts.join(' — ');
  if (customerId) return `Customer ${customerId} — ${summary}`;
  return summary;
}

/** @deprecated Use parseActivityErrorFields */
export function classifyAndParseReason(raw = '') {
  return parseActivityErrorFields({ notes: raw, reason: '' });
}

export function buildFloatingTitle({
  customerName,
  errorType,
  contractValueLabel,
  customerId,
}) {
  return [
    customerName || 'Unknown',
    errorType || 'Error',
    contractValueLabel || NO_CONTRACT_VALUE_LABEL,
    customerId || '—',
  ].join(' - ');
}

export function enrichErrorItem(item) {
  const parsed = parseActivityErrorFields({
    notes: item.notes,
    reason: item.reason,
  });
  const floatingTitle = buildFloatingTitle({
    customerName: item.customerName,
    errorType: parsed.detectedErrorType || parsed.errorType,
    contractValueLabel: parsed.contractValueLabel,
    customerId: item.customerId,
  });

  const isComplete = item.dashboardStatus === 'complete';

  return {
    ...item,
    ...parsed,
    cardSummary: buildCardSummary({
      customerId: item.customerId,
      detectedErrorType: parsed.detectedErrorType,
      detectedServiceType: parsed.detectedServiceType,
      contractValueLabel: parsed.contractValueLabel,
    }),
    floatingTitle,
    label: floatingTitle,
    status: isComplete ? 'Complete' : 'Open',
    isComplete,
  };
}
