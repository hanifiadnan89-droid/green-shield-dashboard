import { TMPL_LABEL, TMPL_COLOR } from './constants.js';

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

export function formatSent(sent) {
  if (!sent || sent === 'imported') return null;
  const d = new Date(sent);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatThreadTime(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` · ${time}`;
}

/** Date divider label for conversation timeline (Today / Yesterday / full date). */
export function formatDateSeparator(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Interleave date dividers with thread messages for timeline UI. */
export function buildThreadWithDateDividers(thread) {
  const items = [];
  let lastDateKey = null;
  for (const msg of thread) {
    const d = msg.ts ? new Date(msg.ts) : null;
    const dateKey = d && !isNaN(d.getTime()) ? d.toDateString() : null;
    if (dateKey && dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      items.push({ type: 'date', id: `date-${dateKey}`, label: formatDateSeparator(msg.ts) });
    }
    items.push({ type: 'message', msg });
  }
  return items;
}

export function formatListTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const archKey = l => `${l.row_number}:${l.sms_reply}`;

/** Stable fingerprint for inbound read cursor (matches server inboundReadKey). */
export function inboundReadKey(message) {
  if (!message || message.direction !== 'inbound') return null;
  const body = (message.body || '').trim();
  if (!body) return null;
  const ts = message.ts || '';
  const channel = message.channel === 'email' ? 'email' : 'sms';
  return `${channel}|${ts}|${body}`;
}

/** @deprecated Use inboundReadKey(getLatestInbound(messages)) */
export function readKey(lead, messages) {
  const inbound = getLatestInbound(messages);
  if (inbound) return `${lead.row_number}:${inboundReadKey(inbound)}`;
  return `${lead.row_number}:empty`;
}

export function isRealReplyText(text) {
  const t = (text || '').trim();
  return t.length > 0 && t !== '.' && t !== 'yes';
}

/** Map server message → UI bubble */
export function mapServerMessage(m) {
  if (!m?.body) {
    console.warn('[Replies] Skipping malformed message:', m);
    return null;
  }
  const isOut = m.direction === 'outbound';
  const isTemplate = m.meta?.isTemplate || m.meta?.type === 'template';
  const notesKey = m.meta?.templateKey || '';
  return {
    id: m.id,
    dir: isOut ? 'out' : 'in',
    direction: m.direction,
    channel: m.channel || 'sms',
    text: m.body,
    ts: m.ts,
    sender: m.sender,
    status: m.status,
    isTemplate,
    color: isTemplate ? (TMPL_COLOR[notesKey] || '#64748B') : undefined,
  };
}

export function buildThreadFromMessages(serverMessages, lead, legacyHistory) {
  const msgs = [];
  const seen = new Set();

  for (const raw of serverMessages || []) {
    const mapped = mapServerMessage(raw);
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    msgs.push(mapped);
  }

  if (lead?.sent && lead.sent !== 'imported' && !msgs.some(m => m.isTemplate)) {
    const k = (lead.notes || '').toLowerCase().trim();
    msgs.push({
      id: `tmpl-${lead.sent}`,
      dir: 'out',
      direction: 'outbound',
      channel: 'sms',
      isTemplate: true,
      text: TMPL_LABEL[k] || 'Initial message sent',
      color: TMPL_COLOR[k] || '#64748B',
      ts: lead.sent,
    });
  }

  if (!msgs.length && lead) {
    return buildThreadLegacy(lead, legacyHistory);
  }

  const h = legacyHistory?.[lead?.row_number] || {};
  for (const out of h.outbound || []) {
    const id = `legacy-out-${out.ts}-${out.text?.slice(0, 12)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    msgs.push({ id, dir: 'out', direction: 'outbound', channel: 'sms', text: out.text, ts: out.ts, sender: 'You' });
  }

  return msgs.sort(compareByTs);
}

/** Legacy fallback when server history is empty */
export function buildThreadLegacy(lead, history) {
  const h = history[lead.row_number] || {};
  const msgs = [];

  if (lead.sent && lead.sent !== 'imported') {
    const k = (lead.notes || '').toLowerCase().trim();
    msgs.push({
      id: 'tmpl',
      dir: 'out',
      direction: 'outbound',
      channel: 'sms',
      isTemplate: true,
      text: TMPL_LABEL[k] || 'Initial message sent',
      color: TMPL_COLOR[k] || '#64748B',
      ts: lead.sent,
    });
  }

  (h.outbound || []).forEach((m, i) =>
    msgs.push({ id: `out-${i}`, dir: 'out', direction: 'outbound', channel: 'sms', text: m.text, ts: m.ts, sender: 'You' }),
  );

  const reply = (lead.sms_reply || '').trim();
  if (reply && reply !== '.' && reply !== 'yes') {
    msgs.push({
      id: 'inbound',
      dir: 'in',
      direction: 'inbound',
      channel: 'sms',
      text: reply,
      ts: h.inboundDetectedAt || null,
      sender: lead.name || 'Customer',
    });
  }

  return msgs.sort(compareByTs);
}

export function buildThread(lead, history, serverMessages) {
  if (serverMessages?.length) {
    return buildThreadFromMessages(serverMessages, lead, history);
  }
  return buildThreadLegacy(lead, history);
}

function compareByTs(a, b) {
  if (!a.ts && !b.ts) return 0;
  if (!a.ts) return 1;
  if (!b.ts) return -1;
  return new Date(a.ts) - new Date(b.ts);
}

export function getLatestInbound(messages) {
  if (!messages?.length) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === 'inbound') return messages[i];
  }
  return null;
}

export function getConversationSortTime(lead, messages, meta) {
  if (meta?.lastAt) return new Date(meta.lastAt).getTime();
  const last = messages?.length ? messages[messages.length - 1] : null;
  if (last?.ts) return new Date(last.ts).getTime();
  if (lead.sent && lead.sent !== 'imported') return new Date(lead.sent).getTime();
  return 0;
}

export function previewFromMessages(messages, meta, lead) {
  if (meta?.preview) return meta.preview;
  const last = messages?.length ? messages[messages.length - 1] : null;
  if (last?.body) {
    const t = last.body.trim();
    return t.length > 72 ? `${t.slice(0, 72)}…` : t;
  }
  const sms = (lead?.sms_reply || '').trim();
  if (sms && sms !== '.' && sms !== 'yes') return sms.length > 72 ? `${sms.slice(0, 72)}…` : sms;
  return '—';
}
