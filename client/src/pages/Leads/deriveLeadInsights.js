import { hasRealReply } from '../CRMPreview/mockData.js';
import { TEMPLATE_META } from '../CRMPreview/mockData.js';
import { isLeadArchived } from './leadsFilters.js';

function parseTs(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function deriveLeadInsights(lead, activity = [], thread = [], meta = {}) {
  const nameMatch = (e) =>
    e.leadName && lead.name &&
    e.leadName.toLowerCase() === lead.name.toLowerCase();

  const leadActivity = activity.filter(nameMatch);
  const outbound = thread.filter(m => m.direction === 'outbound' || m.dir === 'out');
  const inbound = thread.filter(m => m.direction === 'inbound' || m.dir === 'in');

  const contactAttempts =
    leadActivity.filter(e => {
      const a = (e.action || '').toLowerCase();
      return a.includes('send') || a.includes('sms') || a.includes('email');
    }).length + (lead.sent && lead.sent !== 'imported' ? 1 : 0);

  const replyCount =
    inbound.length +
    (hasRealReply(lead.sms_reply) ? 1 : 0) +
    (hasRealReply(lead.email_reply) ? 1 : 0);

  const timestamps = [
    ...leadActivity.map(e => parseTs(e.timestamp)).filter(Boolean),
    ...thread.map(m => parseTs(m.ts)).filter(Boolean),
    parseTs(lead.sent),
    parseTs(meta?.lastAt),
  ].filter(Boolean);

  const lastContact = timestamps.length
    ? new Date(Math.max(...timestamps.map(d => d.getTime())))
    : null;

  const notesKey = (lead.notes || '').toLowerCase().trim();
  const workflow = TEMPLATE_META[notesKey]?.fullLabel || (notesKey ? notesKey.toUpperCase() : 'Not started');

  const agreementSent = notesKey === 'ag';
  const stopped = lead.stop === 'yes' || lead.status === 'stopped';
  const hasError = !!(lead.error && lead.error.trim()) || lead.status === 'error' || lead.status === 'email_failed';
  const hasReply = inbound.length > 0 || hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply) || lead.status === 'replied';
  const sent = lead.sent && lead.sent !== 'imported';

  const followUpPending = sent && !hasReply && !stopped && !hasError && !isLeadArchived(lead);

  let health = 'neutral';
  let healthLabel = 'In sequence';
  if (stopped) { health = 'stopped'; healthLabel = 'Stopped'; }
  else if (hasError) { health = 'error'; healthLabel = 'Needs attention'; }
  else if (hasReply) { health = 'hot'; healthLabel = 'Engaged'; }
  else if (followUpPending) { health = 'warm'; healthLabel = 'Follow-up due'; }
  else if (!sent) { health = 'cold'; healthLabel = 'Not contacted'; }

  const engagementScore = Math.min(100, Math.round(
    (hasReply ? 45 : 0) +
    (sent ? 25 : 0) +
    Math.min(contactAttempts * 8, 24) +
    (inbound.length > 1 ? 10 : 0) +
    (agreementSent ? 6 : 0)
  ));

  const daysSinceSent = sent && lead.sent !== 'imported'
    ? Math.floor((Date.now() - new Date(lead.sent).getTime()) / 86400000)
    : null;

  return {
    contactAttempts,
    replyCount,
    lastContact,
    workflow,
    agreementSent,
    followUpPending,
    archived: isLeadArchived(lead),
    stopped,
    hasError,
    hasReply,
    health,
    healthLabel,
    engagementScore,
    daysSinceSent,
    leadSource: lead.source || lead.lead_source || 'Google Sheet',
    createdDate: sent ? new Date(lead.sent) : null,
  };
}
