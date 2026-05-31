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

export const archKey = l => `${l.row_number}:${l.sms_reply}`;

export function buildThread(lead, history) {
  const h = history[lead.row_number] || {};
  const msgs = [];

  if (lead.sent && lead.sent !== 'imported') {
    const k = (lead.notes || '').toLowerCase().trim();
    msgs.push({
      id: 'tmpl',
      dir: 'out',
      isTemplate: true,
      text: TMPL_LABEL[k] || 'Initial message sent',
      color: TMPL_COLOR[k] || '#64748B',
      ts: lead.sent,
    });
  }

  (h.outbound || []).forEach((m, i) =>
    msgs.push({ id: `out-${i}`, dir: 'out', text: m.text, ts: m.ts })
  );

  const reply = (lead.sms_reply || '').trim();
  if (reply && reply !== '.') {
    msgs.push({ id: 'inbound', dir: 'in', text: reply, ts: h.inboundDetectedAt || null });
  }

  return msgs.sort((a, b) => {
    if (!a.ts && !b.ts) return 0;
    if (!a.ts) return 1;
    if (!b.ts) return -1;
    return new Date(a.ts) - new Date(b.ts);
  });
}
