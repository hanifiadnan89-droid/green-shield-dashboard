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

export function extractServiceType(text = '') {
  const raw = text.toString().trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

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
  const reasonUpper = reasonText.toUpperCase();
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
  category = ERROR_CATEGORIES.other,
} = {}) {
  const originalPrice = price || null;
  const priceAmount = parsePriceAmount(price);
  const originalPriceLabel = buildOriginalPriceLabel(price, serviceType);

  let resolvedService = serviceType;
  if (!resolvedService && category === ERROR_CATEGORIES.unpaid && priceAmount != null) {
    resolvedService = 'IS';
  }

  if (resolvedService === 'IS' && priceAmount != null) {
    const mapped = IS_CONTRACT_VALUE_BY_PRICE[priceAmount];
    if (mapped != null) {
      return {
        contractValue: mapped,
        contractValueLabel: formatUsd(mapped),
        originalPrice,
        originalPriceLabel,
        serviceType: resolvedService,
      };
    }
  }

  if (resolvedService === 'OTS' && priceAmount != null) {
    return {
      contractValue: priceAmount,
      contractValueLabel: formatUsd(priceAmount),
      originalPrice,
      originalPriceLabel,
      serviceType: resolvedService,
    };
  }

  if (category === ERROR_CATEGORIES.pending && priceAmount != null) {
    return {
      contractValue: priceAmount,
      contractValueLabel: formatUsd(priceAmount),
      originalPrice,
      originalPriceLabel,
      serviceType: resolvedService,
    };
  }

  return {
    contractValue: null,
    contractValueLabel: 'No price listed',
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
  const contract = calculateContractValue({ price, serviceType, category });

  const sourceText = notesText || reasonText;

  return {
    notesText,
    reasonRaw: reasonText,
    reasonText,
    parsedFromNotes,
    category,
    errorType,
    price,
    priceLabel: price || 'No price listed',
    serviceType: contract.serviceType ?? serviceType,
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
    contractValueLabel || 'No price listed',
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
