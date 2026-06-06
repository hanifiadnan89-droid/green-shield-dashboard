export const ERROR_CATEGORIES = {
  unpaid: 'unpaid',
  pending: 'pending',
  line_busy: 'line_busy',
  invoice: 'invoice',
  other: 'other',
};

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

export function buildFloatingTitle({ customerName, errorType, priceLabel, customerId }) {
  return [
    customerName || 'Unknown',
    errorType || 'Error',
    priceLabel || 'No price listed',
    customerId || '—',
  ].join(' - ');
}

export function enrichErrorItem(item) {
  const parsed = classifyAndParseReason(item.reason || item.notes);
  const floatingTitle = buildFloatingTitle({
    customerName: item.customerName,
    errorType: parsed.errorType,
    priceLabel: parsed.priceLabel,
    customerId: item.customerId,
  });

  return {
    ...item,
    ...parsed,
    floatingTitle,
    label: floatingTitle,
    status: item.dashboardStatus === 'not complete' ? 'Not Complete' : 'Open',
  };
}
