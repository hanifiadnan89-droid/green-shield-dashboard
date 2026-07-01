import { Lead } from '../../../domain/leads/Lead.js';

export function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function asLower(value) {
  return normalizeText(value).toLowerCase();
}

export function hasRealReply(value) {
  const text = normalizeText(value);
  return text.length > 0 && text !== '.';
}

export function hasSent(item) {
  const sent = normalizeText(item?.raw?.sent ?? item?.sent);
  return Boolean(sent && sent !== 'imported');
}

export function isStopped(item) {
  return Boolean(
    item?.isStopped?.()
    || asLower(item?.raw?.stop ?? item?.stop) === 'yes'
    || asLower(item?.raw?.status ?? item?.status) === 'stopped',
  );
}

export function isReplied(item) {
  return Boolean(
    item?.hasAnyReply?.()
    || hasRealReply(item?.raw?.sms_reply ?? item?.sms_reply)
    || hasRealReply(item?.raw?.email_reply ?? item?.email_reply)
    || asLower(item?.raw?.status ?? item?.status) === 'replied',
  );
}

export function isError(item) {
  return Boolean(
    item?.isError?.()
    || normalizeText(item?.raw?.error ?? item?.error)
    || asLower(item?.raw?.status ?? item?.status) === 'error'
    || asLower(item?.raw?.status ?? item?.status) === 'email_failed',
  );
}

export function templateKey(item) {
  const notes = normalizeText(item?.raw?.notes ?? item?.notes).toLowerCase();
  if (notes === 't/m') return 'tm';
  return notes;
}

export function leadName(item) {
  if (typeof item?.name === 'function') return normalizeText(item.name());
  return normalizeText(item?.name);
}

export function leadRowNumber(item) {
  if (typeof item?.rowNumber === 'function') return item.rowNumber();
  return item?.row_number ?? item?.rowNumber ?? null;
}

export function daysSince(ts) {
  if (!ts || ts === 'imported') return null;
  const parsed = new Date(ts).getTime();
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / 86400000);
}

export function relativeTime(ts) {
  if (!ts) return 'Recently';
  const parsed = new Date(ts).getTime();
  if (Number.isNaN(parsed)) return 'Recently';
  const diff = Date.now() - parsed;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function countInRange(items, start, end, pred = () => true, getTimestamp = (item) => item?.raw?.sent ?? item?.sent ?? null) {
  return items.filter((item) => {
    const ts = getTimestamp(item);
    if (!ts || ts === 'imported') return false;
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return false;
    return date >= start && date < end && pred(item);
  }).length;
}

export function trendPct(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildLeadEntities(context, leads) {
  return (Array.isArray(leads) ? leads : []).map((lead) => Lead.fromRaw(lead, context));
}
