import { TMPL_LABEL, TMPL_COLOR } from './constants.js';
import {
  formatDateMaine,
  formatDateSeparatorMaine,
  formatListTimeMaine,
  formatThreadTimeMaine,
  formatTimeMaine,
} from './repliesTime.js';

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

export function formatSent(sent) {
  return formatDateMaine(sent);
}

export function formatTime(date) {
  return formatTimeMaine(date);
}

export function formatThreadTime(ts) {
  return formatThreadTimeMaine(ts);
}

export function formatDateSeparator(ts) {
  return formatDateSeparatorMaine(ts);
}

export function isTemplateMessage(m) {
  return !!(m?.isTemplate || m?.meta?.isTemplate || m?.meta?.type === 'template');
}

/** UI-only: hide template/system event bubbles; server history unchanged. */
export function filterDisplayThread(thread) {
  return (thread || []).filter(m => !isTemplateMessage(m));
}

/** Interleave date dividers with display messages only (no template events). */
export function buildThreadWithDateDividers(thread) {
  const display = filterDisplayThread(thread);
  const items = [];
  let lastDateKey = null;
  for (const msg of display) {
    if (!msg.ts) {
      items.push({ type: 'message', msg });
      continue;
    }
    const d = new Date(msg.ts);
    if (Number.isNaN(d.getTime())) {
      items.push({ type: 'message', msg });
      continue;
    }
    const label = formatDateSeparator(msg.ts);
    const dateKey = label || msg.ts;
    if (dateKey && dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      items.push({ type: 'date', id: `date-${dateKey}-${msg.id}`, label });
    }
    items.push({ type: 'message', msg });
  }
  return items;
}

export function formatListTime(ts) {
  return formatListTimeMaine(ts);
}

const SERVICE_CODES = {
  na: 'N/A',
  ag: 'AG',
  ch: 'CH',
  iq: 'IQ',
  tm: 'T/M',
  rit: 'RIT',
};

export function formatServiceCode(lead) {
  const key = (lead?.notes || '').toLowerCase().trim();
  if (SERVICE_CODES[key]) return SERVICE_CODES[key];
  const raw = (lead?.reason || lead?.notes || '').trim();
  if (!raw) return null;
  return raw.length > 12 ? `${raw.slice(0, 12)}…` : raw;
}

export function channelReplyLabel(lead) {
  const sms = !!(lead?.sms_reply || '').trim();
  const email = !!(lead?.email_reply || '').trim();
  if (sms && email) return 'SMS & Email';
  if (email) return 'Email Reply';
  if (sms) return 'SMS Reply';
  return null;
}

/** Inline header metadata: "Replied · IQ · SMS Reply" */
export function buildConversationHeaderMeta(lead) {
  const parts = [];
  const hasReplied = !!(lead?.sms_reply?.trim() || lead?.email_reply?.trim());
  if (hasReplied) parts.push('Replied');
  const service = formatServiceCode(lead);
  if (service) parts.push(service);
  const channel = channelReplyLabel(lead);
  if (channel) parts.push(channel);
  return parts.join(' · ');
}

/**
 * Green = customer spoke last (or has inbound on file).
 * Red = rep spoke last / awaiting customer.
 */
export function getConversationStatusTone(lead, messages) {
  const display = filterDisplayThread(messages);
  const last = display.length ? display[display.length - 1] : null;
  if (last) {
    const isOut = last.dir === 'out' || last.direction === 'outbound';
    return isOut ? 'red' : 'green';
  }
  const hasInbound = !!(lead?.sms_reply?.trim() || lead?.email_reply?.trim());
  return hasInbound ? 'green' : 'red';
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
