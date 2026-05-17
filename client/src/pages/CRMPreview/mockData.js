export function deriveStats(leads = []) {
  const today = new Date().toDateString();
  return {
    total:        leads.length,
    stopped:      leads.filter(l => l.stop === 'yes').length,
    errors:       leads.filter(l => (l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed').length,
    smsReplies:   leads.filter(l => l.sms_reply === 'yes').length,
    emailReplies: leads.filter(l => l.email_reply === 'yes').length,
    replied:      leads.filter(l => l.sms_reply === 'yes' || l.email_reply === 'yes' || l.status === 'replied').length,
    inProgress:   leads.filter(l => {
      if (l.stop === 'yes') return false;
      if (l.status === 'replied') return false;
      if (l.sms_reply === 'yes' || l.email_reply === 'yes') return false;
      if ((l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed') return false;
      return !!(l.sent && l.sent !== 'imported');
    }).length,
    sentToday:    leads.filter(l => {
      if (!l.sent || l.sent === 'imported') return false;
      return new Date(l.sent).toDateString() === today;
    }).length,
    sold:  leads.filter(l => l.sold === 'yes').length,
    day1:  leads.filter(l => _daysSince(l.sent) === 0).length,
    day2:  leads.filter(l => _daysSince(l.sent) === 1).length,
    day3:  leads.filter(l => { const d = _daysSince(l.sent); return d !== null && d >= 2; }).length,
    byTemplate: {
      ag:  leads.filter(l => (l.notes || '').toLowerCase() === 'ag').length,
      na:  leads.filter(l => (l.notes || '').toLowerCase() === 'na').length,
      rit: leads.filter(l => (l.notes || '').toLowerCase() === 'rit').length,
      tm:  leads.filter(l => (l.notes || '').toLowerCase() === 't/m').length,
      iq:  leads.filter(l => (l.notes || '').toLowerCase() === 'iq').length,
    },
  };
}

export const TEMPLATE_META = {
  ag:  { label: 'AG',  fullLabel: 'Agreement Sent',    color: '#16A34A', bg: '#f0fdf4', textColor: '#15803d' },
  na:  { label: 'NA',  fullLabel: 'No Answer',          color: '#D97706', bg: '#fffbeb', textColor: '#b45309' },
  rit: { label: 'RIT', fullLabel: 'Rodent & Insect',    color: '#2563EB', bg: '#eff6ff', textColor: '#1d4ed8' },
  tm:  { label: 'T/M', fullLabel: 'Tick & Mosquito',    color: '#ec4899', bg: '#fdf2f8', textColor: '#be185d' },
  iq:  { label: 'IQ',  fullLabel: 'Insect Quarterly',   color: '#9333EA', bg: '#faf5ff', textColor: '#7e22ce' },
};

const AVATAR_PALETTE = [
  { bg: '#dcfce7', text: '#15803d' },
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#f3e8ff', text: '#7e22ce' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#cffafe', text: '#0e7490' },
  { bg: '#fce7f3', text: '#be185d' },
  { bg: '#e0e7ff', text: '#4338ca' },
  { bg: '#fee2e2', text: '#b91c1c' },
];

export function getAvatarStyle(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) { h = (h << 5) - h + name.charCodeAt(i); h |= 0; }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function getInitials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

export function getRowBorderColor(lead) {
  if ((lead.error && lead.error.trim()) || lead.status === 'error' || lead.status === 'email_failed') return '#DC2626';
  if (lead.stop === 'yes' || lead.status === 'stopped') return '#94A3B8';
  if (lead.sms_reply === 'yes' || lead.email_reply === 'yes' || lead.status === 'replied') return '#16A34A';
  if ((lead.notes || '').toLowerCase() === 'na') return '#D97706';
  if (lead.sent && lead.sent !== 'imported') return '#2563EB';
  return '#E2E8F0';
}

export function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function daysSince(ts) {
  if (!ts || ts === 'imported') return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}
const _daysSince = daysSince;
const _isReplied = l => l.sms_reply === 'yes' || l.email_reply === 'yes' || l.status === 'replied';
const _isError   = l => !!(l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed';
const _isStopped = l => l.stop === 'yes' || l.status === 'stopped';
const _hasSent   = l => !!(l.sent && l.sent !== 'imported');

export function deriveSalesStats(leads = []) {
  const active = leads.filter(l => !_isStopped(l));
  return {
    needsAction:       active.filter(_isReplied).length + leads.filter(_isError).length,
    hotReplies:        active.filter(_isReplied).length,
    agreementsPending: active.filter(l => (l.notes || '').toLowerCase() === 'ag' && !_isReplied(l) && !_isError(l) && _hasSent(l)).length,
    followUpQueue:     active.filter(l => _hasSent(l) && !_isReplied(l) && !_isError(l)).length,
  };
}

export function getPriorityLeads(leads = []) {
  const active = leads.filter(l => !_isStopped(l));

  const replied = active
    .filter(_isReplied)
    .map(l => ({ ...l, _group: 'replied', _reason: l.sms_reply === 'yes' ? 'SMS reply received' : l.email_reply === 'yes' ? 'Email reply received' : 'Replied', _days: _daysSince(l.sent) }));

  const agreements = active
    .filter(l => (l.notes || '').toLowerCase() === 'ag' && !_isReplied(l) && !_isError(l) && _hasSent(l))
    .map(l => ({ ...l, _group: 'agreement', _reason: 'Agreement sent — awaiting reply', _days: _daysSince(l.sent) }))
    .sort((a, b) => (b._days ?? 0) - (a._days ?? 0));

  const noAnswer = active
    .filter(l => (l.notes || '').toLowerCase() === 'na' && !_isReplied(l) && !_isError(l) && _hasSent(l))
    .map(l => ({ ...l, _group: 'noAnswer', _reason: 'No answer — follow-up needed', _days: _daysSince(l.sent) }))
    .sort((a, b) => (b._days ?? 0) - (a._days ?? 0));

  const inSequence = active
    .filter(l => {
      const n = (l.notes || '').toLowerCase();
      return ['rit', 't/m', 'iq'].includes(n) && !_isReplied(l) && !_isError(l) && _hasSent(l) && (_daysSince(l.sent) ?? 0) >= 2;
    })
    .map(l => ({ ...l, _group: 'inSequence', _reason: 'In sequence — follow-up due', _days: _daysSince(l.sent) }))
    .sort((a, b) => (b._days ?? 0) - (a._days ?? 0));

  const errors = leads
    .filter(_isError)
    .map(l => ({ ...l, _group: 'error', _reason: (l.error && l.error.trim()) ? l.error : 'Send failed', _days: _daysSince(l.sent) }));

  const totals = { replied: replied.length, agreements: agreements.length, noAnswer: noAnswer.length, inSequence: inSequence.length, errors: errors.length };
  return {
    replied:    replied.slice(0, 5),
    agreements: agreements.slice(0, 5),
    noAnswer:   noAnswer.slice(0, 5),
    inSequence: inSequence.slice(0, 4),
    errors:     errors.slice(0, 3),
    totals,
    isEmpty: Object.values(totals).every(v => v === 0),
  };
}

export function getActivityMeta(action = '') {
  const a = action.toLowerCase();
  if (a.includes('sms')) return { label: 'SMS Sent', bg: '#f0fdf4', color: '#16A34A' };
  if (a.includes('email') && !a.includes('fail')) return { label: 'Email Sent', bg: '#eff6ff', color: '#2563EB' };
  if (a.includes('error') || a.includes('fail')) return { label: 'Send Failed', bg: '#fef2f2', color: '#DC2626' };
  if (a.includes('unstop') || a.includes('resume')) return { label: 'Lead Resumed', bg: '#f0fdf4', color: '#16A34A' };
  if (a.includes('stop')) return { label: 'Lead Stopped', bg: '#fff7ed', color: '#D97706' };
  if (a.includes('send') || a.includes('sent')) return { label: 'Template Sent', bg: '#faf5ff', color: '#9333EA' };
  const label = action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { label, bg: '#f8fafc', color: '#64748B' };
}
