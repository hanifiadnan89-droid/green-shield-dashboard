/** Client-side message merge + dedupe (matches server messageKey). */
export function messageKey(m) {
  const direction = m.direction === 'inbound' ? 'inbound' : 'outbound';
  const channel = m.channel === 'email' ? 'email' : 'sms';
  const body = (m.body || m.text || '').trim();
  const ts = m.ts || m.timestamp || '';
  return `${direction}|${channel}|${body}|${ts}`;
}

export function mergeMessageLists(existing = [], incoming = []) {
  const byKey = new Map();
  for (const raw of [...existing, ...incoming]) {
    if (!raw) continue;
    const body = (raw.body || raw.text || '').trim();
    if (!body) continue;
    const normalized = {
      ...raw,
      body,
      direction: raw.direction === 'inbound' ? 'inbound' : 'outbound',
      channel: raw.channel === 'email' ? 'email' : 'sms',
      ts: raw.ts || raw.timestamp || null,
    };
    byKey.set(messageKey(normalized), normalized);
  }
  return [...byKey.values()].sort((a, b) => {
    const ta = a.ts ? new Date(a.ts).getTime() : NaN;
    const tb = b.ts ? new Date(b.ts).getTime() : NaN;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
}
