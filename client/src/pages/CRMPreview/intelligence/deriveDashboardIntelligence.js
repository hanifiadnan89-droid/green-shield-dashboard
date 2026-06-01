import { daysSince, hasRealReply } from '../mockData.js';

const isReplied = (l) =>
  hasRealReply(l.sms_reply) || hasRealReply(l.email_reply) || l.status === 'replied';
const isError = (l) =>
  !!(l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed';
const isStopped = (l) => l.stop === 'yes' || l.status === 'stopped';
const hasSent = (l) => !!(l.sent && l.sent !== 'imported');

const templateKey = (l) => (l.notes || '').toLowerCase();

function isAgreementPending(l) {
  return (
    !isStopped(l) &&
    templateKey(l) === 'ag' &&
    !isReplied(l) &&
    !isError(l) &&
    hasSent(l)
  );
}

function isOverdueFollowUp(l) {
  if (isStopped(l) || !hasSent(l) || isReplied(l) || isError(l)) return false;
  const days = daysSince(l.sent);
  if (days === null) return false;
  const n = templateKey(l);
  if (n === 'na' && days >= 1) return true;
  if (['rit', 't/m', 'iq'].includes(n) && days >= 2) return true;
  return false;
}

/**
 * Heuristic priority score (higher = more urgent). Not ML.
 * @param {Record<string, unknown>} lead
 * @param {(lead: Record<string, unknown>) => boolean} isUnreadReply
 */
export function scoreHotLead(lead, isUnreadReply) {
  if (isStopped(lead)) return { score: 0, reason: null };

  let score = 0;
  let reason = 'Needs review';

  if (isUnreadReply(lead)) {
    score += 100;
    reason = 'Unread SMS reply';
  } else if (isError(lead)) {
    score += 90;
    reason = (lead.error && String(lead.error).trim()) || 'Send failed';
  } else if (isReplied(lead) && !isUnreadReply(lead)) {
    score += 75;
    reason = 'Customer replied';
  } else if (isAgreementPending(lead)) {
    const days = daysSince(lead.sent) ?? 0;
    score += 55 + Math.min(days, 14);
    reason = days > 0 ? `Agreement pending · ${days}d` : 'Agreement pending';
  } else if (isOverdueFollowUp(lead)) {
    const days = daysSince(lead.sent) ?? 0;
    score += 45 + Math.min(days, 14);
    const n = templateKey(lead);
    reason = n === 'na' ? `No answer overdue · ${days}d` : `Sequence follow-up · ${days}d`;
  }

  if (score === 0) return { score: 0, reason: null };
  return { score, reason };
}

/**
 * @param {Record<string, unknown>[]} leads
 * @param {{ isUnreadReply?: (lead: Record<string, unknown>) => boolean }} [options]
 */
export function deriveDashboardIntelligence(leads = [], options = {}) {
  const isUnreadReply = options.isUnreadReply ?? (() => false);
  const active = leads.filter((l) => !isStopped(l));

  const unreadRows = new Set(
    leads.filter(isUnreadReply).map((l) => l.row_number),
  );
  const errorRows = new Set(leads.filter(isError).map((l) => l.row_number));
  const actionRowIds = new Set([...unreadRows, ...errorRows]);

  const agreementsPending = active.filter(isAgreementPending).length;

  const overdueFollowUps = active.filter(isOverdueFollowUp).length;

  const sentLeads = leads.filter(hasSent);
  const sentCount = sentLeads.length;
  const repliedSentCount = sentLeads.filter(isReplied).length;
  const sentToReplyPercent =
    sentCount > 0 ? Math.round((repliedSentCount / sentCount) * 1000) / 10 : null;

  const soldCount = leads.filter((l) => l.sold === 'yes').length;
  const soldRatePercent =
    sentCount > 0 ? Math.round((soldCount / sentCount) * 1000) / 10 : null;

  const scored = leads
    .map((lead) => {
      const { score, reason } = scoreHotLead(lead, isUnreadReply);
      return {
        lead,
        score,
        reason,
        days: daysSince(lead.sent),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const hotLeads = scored.slice(0, 5);

  return {
    actionToday: actionRowIds.size,
    agreementsPending,
    overdueFollowUps,
    sentCount,
    repliedSentCount,
    sentToReplyPercent,
    soldCount,
    soldRatePercent,
    hotLeads,
  };
}
