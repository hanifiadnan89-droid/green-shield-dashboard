import { hasRealReply } from '../CRMPreview/mockData.js';

export function daysSince(dateStr) {
  if (!dateStr || dateStr === 'imported') return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/** Same in-flight criteria as the legacy Follow-ups page */
export function isInFlightFollowup(lead) {
  if (lead.stop === 'yes') return false;
  if (lead.status === 'replied') return false;
  if (lead.status === 'archived' && (!lead.sent || lead.sent === 'imported')) return false;
  if (!lead.sent || lead.sent === 'imported') return false;
  return true;
}

export function isStoppedFollowup(lead) {
  return lead.stop === 'yes' && lead.sent && lead.sent !== 'imported';
}

export function isRepliedFollowup(lead) {
  if (!lead.sent || lead.sent === 'imported') return false;
  return lead.status === 'replied' || hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply);
}

export function getUrgencyTier(days) {
  if (days === null) return 'none';
  if (days >= 6) return 'overdue';
  if (days >= 3) return 'watch';
  return 'fresh';
}

export function deriveDisplayStatus(lead, days) {
  if (lead.stop === 'yes') return { key: 'stopped', label: 'Stopped' };
  if (isRepliedFollowup(lead)) return { key: 'replied', label: 'Replied' };
  if (days !== null && days >= 6) return { key: 'overdue', label: 'Overdue' };
  if ((lead.error && lead.error.trim()) || lead.status === 'error' || lead.status === 'email_failed') {
    return { key: 'error', label: 'Needs attention' };
  }
  if (lead.status === 'sent' || lead.status === 'active' || !lead.status) {
    return { key: 'in_flight', label: 'In flight' };
  }
  if (lead.status === 'archived') return { key: 'completed', label: 'Completed' };
  return { key: 'sent', label: 'Sent' };
}

export function needsManualAction(lead, days) {
  if (days !== null && days >= 6) return true;
  if (lead.error && lead.error.trim()) return true;
  if (lead.status === 'error' || lead.status === 'email_failed') return true;
  return false;
}

export function getNextScheduledTouch(days) {
  if (days === null) return null;
  if (days < 2) return { label: '2-day follow-up', detail: `~${2 - days} day${2 - days === 1 ? '' : 's'} remaining`, dueIn: 2 - days };
  if (days < 5) return { label: '5-day follow-up', detail: `~${5 - days} day${5 - days === 1 ? '' : 's'} remaining`, dueIn: 5 - days };
  return { label: 'Sequence complete', detail: 'Awaiting reply or manual action', dueIn: null };
}

export function computeKpis(allLeads, inFlightLeads) {
  const overdue = inFlightLeads.filter(l => (daysSince(l.sent) ?? 0) >= 6).length;
  const stopped = allLeads.filter(isStoppedFollowup).length;
  const replied = allLeads.filter(isRepliedFollowup).length;
  const daysList = inFlightLeads.map(l => daysSince(l.sent)).filter(d => d !== null);
  const avgDays = daysList.length
    ? Math.round((daysList.reduce((a, b) => a + b, 0) / daysList.length) * 10) / 10
    : 0;

  return {
    active: inFlightLeads.length,
    overdue,
    stopped,
    replied,
    avgDays,
  };
}

export const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'in_flight', label: 'In Flight' },
  { id: 'replied', label: 'Replied' },
  { id: 'stopped', label: 'Stopped' },
  { id: 'manual', label: 'Needs Manual Action' },
];

export function applyQuickFilter(filterId, inFlightLeads, allLeads) {
  switch (filterId) {
    case 'overdue':
      return inFlightLeads.filter(l => (daysSince(l.sent) ?? 0) >= 6);
    case 'in_flight':
      return inFlightLeads.filter(l => {
        const d = daysSince(l.sent);
        return d !== null && d < 6;
      });
    case 'replied':
      return allLeads.filter(isRepliedFollowup);
    case 'stopped':
      return allLeads.filter(isStoppedFollowup);
    case 'manual':
      return inFlightLeads.filter(l => needsManualAction(l, daysSince(l.sent)));
    case 'all':
    default:
      return inFlightLeads;
  }
}

export function templateCode(lead) {
  return (lead.notes || '').toString().toLowerCase().trim();
}
