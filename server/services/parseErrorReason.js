export const ERROR_CATEGORIES = {
  unpaid: 'unpaid',
  pending: 'pending',
  line_busy: 'line_busy',
  invoice: 'invoice',
  other: 'other',
};

const UNPAID_CONTRACT_VALUE_BY_PRICE = {
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

export function isOtsOnlyReason(raw = '') {
  const upper = raw.toString().toUpperCase();
  if (!/\bOTS\b/.test(upper)) return false;
  return !/UNPAID|IS\/OTS|\bINITIAL\b/.test(upper);
}

export function calculateContractValue({ category, price, reasonRaw = '' }) {
  const originalPrice = price || null;
  const priceAmount = parsePriceAmount(price);

  if (category === ERROR_CATEGORIES.unpaid && priceAmount != null) {
    const mapped = UNPAID_CONTRACT_VALUE_BY_PRICE[priceAmount];
    if (mapped != null) {
      return {
        contractValue: mapped,
        contractValueLabel: formatUsd(mapped),
        originalPrice,
        originalPriceLabel: originalPrice || 'No price listed',
      };
    }
  }

  if (isOtsOnlyReason(reasonRaw) && priceAmount != null) {
    return {
      contractValue: priceAmount,
      contractValueLabel: formatUsd(priceAmount),
      originalPrice,
      originalPriceLabel: originalPrice || 'No price listed',
    };
  }

  if (category === ERROR_CATEGORIES.pending && priceAmount != null) {
    return {
      contractValue: priceAmount,
      contractValueLabel: formatUsd(priceAmount),
      originalPrice,
      originalPriceLabel: originalPrice || 'No price listed',
    };
  }

  return {
    contractValue: null,
    contractValueLabel: 'No price listed',
    originalPrice,
    originalPriceLabel: originalPrice || 'No price listed',
  };
}

export function classifyAndParseReason(raw = '') {
  const text = (raw ?? '').toString().trim();
  const upper = text.toUpperCase();

  const priceMatch = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  const price = priceMatch ? `$${priceMatch[1].replace(/,/g, '')}` : null;

  let category = ERROR_CATEGORIES.other;
  let errorType = text || 'Error';

  if (/UNPAID|IS\/OTS|\bINITIAL\b/.test(upper)) {
    category = ERROR_CATEGORIES.unpaid;
    errorType = 'Unpaid Initial';
  } else if (/\bOTS\b.*PENDING|PENDING.*\bOTS\b|\bOTS PENDING\b/.test(upper)) {
    category = ERROR_CATEGORIES.pending;
    errorType = 'OTS Pending';
  } else if (/\bPENDING\b/.test(upper) && !/UNPAID/.test(upper)) {
    category = ERROR_CATEGORIES.pending;
    errorType = 'Pending';
  } else if (/LINE BUSY|\bLVM\b|LEFT VOICEMAIL|VOICEMAIL/.test(upper)) {
    category = ERROR_CATEGORIES.line_busy;
    errorType = 'Line Busy';
  } else if (/INVOICE|REQUESTED INVOICE/.test(upper)) {
    category = ERROR_CATEGORIES.invoice;
    errorType = 'Invoice';
  } else if (/NO SALE/.test(upper)) {
    category = ERROR_CATEGORIES.other;
    errorType = 'No Sale';
  } else if (/SUBSCRIPTION/.test(upper)) {
    category = ERROR_CATEGORIES.other;
    errorType = 'Subscription';
  } else if (isOtsOnlyReason(text)) {
    category = ERROR_CATEGORIES.pending;
    errorType = 'OTS';
  } else if (text) {
    const short = text.split(/\s{2,}|—|-/)[0].trim();
    errorType = short.length > 42 ? `${short.slice(0, 39)}…` : short;
  }

  return {
    reasonRaw: text,
    category,
    errorType,
    price,
    priceLabel: price || 'No price listed',
  };
}

export function buildFloatingTitle({ customerName, errorType, contractValueLabel, customerId }) {
  return [
    customerName || 'Unknown',
    errorType || 'Error',
    contractValueLabel || 'No price listed',
    customerId || '—',
  ].join(' - ');
}

export function enrichErrorItem(item) {
  const parsed = classifyAndParseReason(item.reason || item.notes);
  const contract = calculateContractValue({
    category: parsed.category,
    price: parsed.price,
    reasonRaw: parsed.reasonRaw,
  });
  const floatingTitle = buildFloatingTitle({
    customerName: item.customerName,
    errorType: parsed.errorType,
    contractValueLabel: contract.contractValueLabel,
    customerId: item.customerId,
  });

  const isComplete = item.dashboardStatus === 'complete';

  return {
    ...item,
    ...parsed,
    ...contract,
    floatingTitle,
    label: floatingTitle,
    status: isComplete ? 'Complete' : 'Open',
    isComplete,
  };
}
