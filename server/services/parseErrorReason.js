export const ERROR_CATEGORIES = {
  unpaid: 'unpaid',
  pending: 'pending',
  line_busy: 'line_busy',
  invoice: 'invoice',
  other: 'other',
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
  return /\bTMM\b/i.test(text.toString());
}

export function extractServiceType(text = '') {
  const raw = text.toString().trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  if (isTmmNotes(raw)) return 'TMM';

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

export function buildOriginalPriceLabel(price, serviceType) {
  if (!price) return 'No price listed';
  if (serviceType) return `${price} ${serviceType}`;
  return price;
}

export function classifyErrorType({ notesText = '', reasonText = '', serviceType = null } = {}) {
  const notesUpper = notesText.toUpperCase();
  const combined = `${notesText} ${reasonText}`.trim().toUpperCase();

  if (/LINE BUSY|\bLVM\b|LEFT VOICEMAIL|VOICEMAIL/.test(combined)) {
    return { category: ERROR_CATEGORIES.line_busy, errorType: 'Line Busy' };
  }

  if (/INVOICE|REQUESTED INVOICE/.test(combined)) {
    return { category: ERROR_CATEGORIES.invoice, errorType: 'Invoice' };
  }

  const hasUnpaid = /UNPAID|IS\/OTS|\bINITIAL\b/.test(combined);
  const hasPending = /\bPENDING\b/.test(combined);
  const resolvedService = serviceType
    || extractServiceType(notesText)
    || extractServiceType(reasonText);

  if (/\bTMM\b/.test(combined)) {
    return { category: ERROR_CATEGORIES.other, errorType: 'TMM' };
  }

  if (hasPending && (resolvedService === 'OTS' || /\bOTS\b/.test(combined))) {
    return { category: ERROR_CATEGORIES.pending, errorType: 'OTS Pending' };
  }

  if (resolvedService === 'IS'
    || (/UNPAID/.test(combined) && resolvedService === 'IS')
    || (hasUnpaid && (resolvedService === 'IS' || (!resolvedService && /UNPAID|IS\/OTS/.test(combined))))) {
    return { category: ERROR_CATEGORIES.unpaid, errorType: 'Unpaid Initial' };
  }

  if (hasPending && !/UNPAID/.test(combined)) {
    return { category: ERROR_CATEGORIES.pending, errorType: 'Pending' };
  }

  if (resolvedService === 'OTS') {
    return { category: ERROR_CATEGORIES.pending, errorType: 'OTS' };
  }

  if (/NO SALE/.test(combined)) {
    return { category: ERROR_CATEGORIES.other, errorType: 'No Sale' };
  }

  if (/SUBSCRIPTION/.test(combined)) {
    return { category: ERROR_CATEGORIES.other, errorType: 'Subscription' };
  }

  const source = notesText || reasonText;
  if (source) {
    const short = source.split(/\s{2,}|—|-/)[0].trim();
    const errorType = short.length > 42 ? `${short.slice(0, 39)}…` : short;
    return { category: ERROR_CATEGORIES.other, errorType };
  }

  return { category: ERROR_CATEGORIES.other, errorType: 'Error' };
}

export function calculateContractValue({
  price,
  serviceType = null,
  notesText = '',
  reasonText = '',
} = {}) {
  const sourceText = `${notesText} ${reasonText}`.trim();
  const originalPrice = price || null;
  const priceAmount = parsePriceAmount(price);
  const hasTmm = isTmmNotes(notesText) || isTmmNotes(reasonText);
  const resolvedService = hasTmm ? 'TMM' : serviceType;
  const originalPriceLabel = buildOriginalPriceLabel(price, resolvedService);

  if (priceAmount == null) {
    return {
      contractValue: null,
      contractValueLabel: NO_CONTRACT_VALUE_LABEL,
      originalPrice,
      originalPriceLabel,
      serviceType: resolvedService,
    };
  }

  // 1. TMM → price × 6 (full Apr–Sep season)
  if (hasTmm) {
    const contractValue = priceAmount * TMM_TREATMENTS_PER_SEASON;
    return {
      contractValue,
      contractValueLabel: formatUsd(contractValue),
      originalPrice,
      originalPriceLabel,
      serviceType: 'TMM',
    };
  }

  // 2. OTS → listed price only
  if (serviceType === 'OTS') {
    return {
      contractValue: priceAmount,
      contractValueLabel: formatUsd(priceAmount),
      originalPrice,
      originalPriceLabel,
      serviceType: 'OTS',
    };
  }

  // 3. IS $449 → $1,164
  if (serviceType === 'IS' && priceAmount === 449) {
    return {
      contractValue: IS_CONTRACT_VALUE_BY_PRICE[449],
      contractValueLabel: formatUsd(IS_CONTRACT_VALUE_BY_PRICE[449]),
      originalPrice,
      originalPriceLabel,
      serviceType: 'IS',
    };
  }

  // 4. IS $399 → $1,048
  if (serviceType === 'IS' && priceAmount === 399) {
    return {
      contractValue: IS_CONTRACT_VALUE_BY_PRICE[399],
      contractValueLabel: formatUsd(IS_CONTRACT_VALUE_BY_PRICE[399]),
      originalPrice,
      originalPriceLabel,
      serviceType: 'IS',
    };
  }

  // 5. No IS/OTS label but $449 → $1,164
  if (!serviceType && priceAmount === 449) {
    return {
      contractValue: IS_CONTRACT_VALUE_BY_PRICE[449],
      contractValueLabel: formatUsd(IS_CONTRACT_VALUE_BY_PRICE[449]),
      originalPrice,
      originalPriceLabel,
      serviceType: null,
    };
  }

  // 6. No IS/OTS label but $399 → $1,048
  if (!serviceType && priceAmount === 399) {
    return {
      contractValue: IS_CONTRACT_VALUE_BY_PRICE[399],
      contractValueLabel: formatUsd(IS_CONTRACT_VALUE_BY_PRICE[399]),
      originalPrice,
      originalPriceLabel,
      serviceType: null,
    };
  }

  return {
    contractValue: null,
    contractValueLabel: NO_CONTRACT_VALUE_LABEL,
    originalPrice,
    originalPriceLabel,
    serviceType: resolvedService,
  };
}

export function parseActivityErrorFields({ notes = '', reason = '' } = {}) {
  const notesText = (notes ?? '').toString().trim();
  const reasonText = (reason ?? '').toString().trim();
  const parsedFromNotes = Boolean(notesText);

  const price = extractPrice(notesText) || extractPrice(reasonText);
  const serviceType = extractServiceType(notesText) || extractServiceType(reasonText);
  const { category, errorType } = classifyErrorType({ notesText, reasonText, serviceType });
  const contract = calculateContractValue({
    price,
    serviceType: serviceType === 'TMM' ? null : serviceType,
    notesText,
    reasonText,
  });

  const sourceText = notesText || reasonText;
  const resolvedServiceType = contract.serviceType ?? serviceType;

  return {
    notesText,
    reasonRaw: reasonText,
    reasonText,
    parsedFromNotes,
    category,
    errorType,
    price,
    priceLabel: price || 'No price listed',
    serviceType: resolvedServiceType,
    sourceText,
    ...contract,
  };
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
    errorType: parsed.errorType,
    contractValueLabel: parsed.contractValueLabel,
    customerId: item.customerId,
  });

  const isComplete = item.dashboardStatus === 'complete';

  return {
    ...item,
    ...parsed,
    floatingTitle,
    label: floatingTitle,
    status: isComplete ? 'Complete' : 'Open',
    isComplete,
  };
}
