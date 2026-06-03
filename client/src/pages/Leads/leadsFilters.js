import { hasRealReply } from '../CRMPreview/mockData.js';

export const CATEGORY_META = {
  replies:    { label: 'Replies',     desc: 'Leads that replied via SMS or email, or have replied status' },
  sent:       { label: 'Sent',        desc: 'Leads that have been sent a template' },
  errors:     { label: 'Errors',      desc: 'Leads with an error or failed send' },
  stopped:    { label: 'Stopped',     desc: 'Leads with follow-ups stopped' },
  inprogress: { label: 'In Progress', desc: 'Active leads still waiting for a response' },
};

export const STATUS_OPTIONS = ['', 'archived', 'active', 'replied', 'stopped'];
export const NOTE_OPTIONS   = ['', 'ag', 'na', 'rit', 't/m', 'iq'];
export const BOOL_OPTIONS   = ['', 'yes'];

export const QUICK_FILTERS = [
  { id: 'all',           label: 'All' },
  { id: 'active',        label: 'Active' },
  { id: 'replied',       label: 'Replied', category: 'replies' },
  { id: 'sent',          label: 'Sent', category: 'sent' },
  { id: 'no_answer',     label: 'No Answer', notes: 'na' },
  { id: 'agreement',     label: 'Agreement Sent', notes: 'ag' },
  { id: 'archived',      label: 'Archived', status: 'archived' },
  { id: 'followup',      label: 'Needs Follow-up', category: 'inprogress' },
];

export function applyCategoryFilter(leads, category) {
  if (!category) return leads;
  switch (category) {
    case 'replies':
      return leads.filter(l =>
        hasRealReply(l.sms_reply) ||
        hasRealReply(l.email_reply) ||
        l.status === 'replied'
      );
    case 'sent':
      return leads.filter(l => l.sent && l.sent.trim() && l.sent !== 'imported');
    case 'errors':
      return leads.filter(l =>
        (l.error && l.error.trim()) ||
        l.status === 'error' ||
        l.status === 'email_failed'
      );
    case 'stopped':
      return leads.filter(l => l.stop === 'yes' || l.status === 'stopped');
    case 'inprogress':
      return leads.filter(l => {
        if (l.stop === 'yes' || l.status === 'stopped') return false;
        if (l.status === 'replied' || hasRealReply(l.sms_reply) || hasRealReply(l.email_reply)) return false;
        if ((l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed') return false;
        return true;
      });
    default:
      return leads;
  }
}

export function applyQuickFilter(leads, quickId) {
  if (!quickId || quickId === 'all') return leads;
  switch (quickId) {
    case 'active':
      return leads.filter(l => (l.status || '').toLowerCase() === 'active');
    case 'replied':
      return applyCategoryFilter(leads, 'replies');
    case 'sent':
      return applyCategoryFilter(leads, 'sent');
    case 'no_answer':
      return leads.filter(l => (l.notes || '').toLowerCase() === 'na');
    case 'agreement':
      return leads.filter(l => (l.notes || '').toLowerCase() === 'ag');
    case 'archived':
      return leads.filter(l => (l.status || '').toLowerCase() === 'archived');
    case 'followup':
      return applyCategoryFilter(leads, 'inprogress');
    default:
      return leads;
  }
}

export function filterLeads(leads, { search, filters, category, notesParam, quickFilter }) {
  let result = applyCategoryFilter(leads, category);
  if (quickFilter && quickFilter !== 'all' && !category) {
    result = applyQuickFilter(result, quickFilter);
  }
  result = result.filter(lead => {
    if (search) {
      const q = search.toLowerCase();
      const match = ['name', 'email', 'phone', 'notes', 'status', 'sms_reply', 'email_reply'].some(
        f => (lead[f] || '').toLowerCase().includes(q)
      );
      if (!match) return false;
    }
    const effectiveFilters = notesParam ? { ...filters, notes: notesParam } : filters;
    for (const [key, val] of Object.entries(effectiveFilters)) {
      if (val && (lead[key] || '').toLowerCase() !== val.toLowerCase()) return false;
    }
    return true;
  });
  return [...result].sort((a, b) => b.row_number - a.row_number);
}

export function isLeadPriority(lead) {
  if (hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply)) return true;
  if ((lead.error && lead.error.trim()) || lead.status === 'error' || lead.status === 'email_failed') return true;
  return (lead.status || '').toLowerCase() === 'active';
}

export function isLeadUnread(lead) {
  return hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply);
}

export function resolveQuickFilterId({ category, notesParam, filters }) {
  if (category === 'replies') return 'replied';
  if (category === 'sent') return 'sent';
  if (category === 'inprogress') return 'followup';
  if (notesParam === 'na') return 'no_answer';
  if (notesParam === 'ag') return 'agreement';
  if ((filters.status || '').toLowerCase() === 'archived') return 'archived';
  if ((filters.status || '').toLowerCase() === 'active') return 'active';
  if (category || notesParam) return 'all';
  return 'all';
}
