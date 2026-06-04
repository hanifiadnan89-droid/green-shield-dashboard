/** Maine business timezone for all Replies timestamps. */
export const REPLIES_TIME_ZONE = 'America/New_York';

const LOCALE = 'en-US';

function parseDate(value) {
  if (value == null || value === '' || value === 'imported') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function zonedYmd(d, timeZone = REPLIES_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function zonedNowYmd(timeZone = REPLIES_TIME_ZONE) {
  return zonedYmd(new Date(), timeZone);
}

function zonedYesterdayYmd(timeZone = REPLIES_TIME_ZONE) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return zonedYmd(d, timeZone);
}

export function formatTimeMaine(value, options = {}) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toLocaleTimeString(LOCALE, {
    timeZone: REPLIES_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  });
}

export function formatDateMaine(value, options = {}) {
  const d = parseDate(value);
  if (!d) return null;
  return d.toLocaleDateString(LOCALE, {
    timeZone: REPLIES_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

export function formatThreadTimeMaine(ts) {
  const d = parseDate(ts);
  if (!d) return null;
  const ymd = zonedYmd(d);
  const time = formatTimeMaine(d);
  if (ymd === zonedNowYmd()) return `Today · ${time}`;
  if (ymd === zonedYesterdayYmd()) return `Yesterday · ${time}`;
  const date = formatDateMaine(d, { year: undefined });
  return `${date} · ${time}`;
}

export function formatDateSeparatorMaine(ts) {
  const d = parseDate(ts);
  if (!d) return null;
  const ymd = zonedYmd(d);
  if (ymd === zonedNowYmd()) return 'Today';
  if (ymd === zonedYesterdayYmd()) return 'Yesterday';
  return formatDateMaine(d);
}

export function formatListTimeMaine(ts) {
  const d = parseDate(ts);
  if (!d) return '';
  if (zonedYmd(d) === zonedNowYmd()) return formatTimeMaine(d);
  return d.toLocaleDateString(LOCALE, {
    timeZone: REPLIES_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  });
}

/** Prefer message/meta times over outreach `sent` for list sorting display. */
export function resolveConversationListTime(lead, messages, meta) {
  if (meta?.lastAt) return meta.lastAt;
  const real = (messages || []).filter(
    m => !(m.meta?.isTemplate || m.meta?.type === 'template'),
  );
  const last = real.length ? real[real.length - 1] : null;
  if (last?.ts) return last.ts;
  if (lead?.sent && lead.sent !== 'imported') return lead.sent;
  return null;
}
