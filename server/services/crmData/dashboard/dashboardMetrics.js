import {
  getLeadVisibilityScope,
  isScopedLeadAccessEnabled,
} from '../../leadAccess.js';
import {
  daysSince,
  hasSent,
  isError,
  isReplied,
  isStopped,
  templateKey,
} from './dashboardUtils.js';

export function buildLeadMetrics(context, leadEntities) {
  const today = new Date().toDateString();

  const total = leadEntities.length;
  const stopped = leadEntities.filter((lead) => isStopped(lead)).length;
  const errors = leadEntities.filter((lead) => isError(lead)).length;
  const smsReplies = leadEntities.filter((lead) => lead.hasSmsReply()).length;
  const emailReplies = leadEntities.filter((lead) => lead.hasEmailReply()).length;
  const replied = leadEntities.filter((lead) => isReplied(lead)).length;
  const sold = leadEntities.filter((lead) => lead.isSold()).length;
  const deleted = leadEntities.filter((lead) => lead.isDeleted()).length;
  const active = leadEntities.filter((lead) => hasSent(lead) && !isStopped(lead) && !isReplied(lead) && !isError(lead)).length;
  const inProgress = active;
  const sentToday = leadEntities.filter((lead) => {
    const sent = lead.raw?.sent;
    if (!hasSent(lead)) return false;
    const sentDate = new Date(sent);
    return !Number.isNaN(sentDate.getTime()) && sentDate.toDateString() === today;
  }).length;

  const day1 = leadEntities.filter((lead) => daysSince(lead.raw?.sent) === 0).length;
  const day2 = leadEntities.filter((lead) => daysSince(lead.raw?.sent) === 1).length;
  const day3 = leadEntities.filter((lead) => {
    const days = daysSince(lead.raw?.sent);
    return days !== null && days >= 2;
  }).length;

  const byTemplate = {
    ag: leadEntities.filter((lead) => templateKey(lead) === 'ag').length,
    na: leadEntities.filter((lead) => templateKey(lead) === 'na').length,
    rit: leadEntities.filter((lead) => templateKey(lead) === 'rit').length,
    tm: leadEntities.filter((lead) => templateKey(lead) === 'tm').length,
    iq: leadEntities.filter((lead) => templateKey(lead) === 'iq').length,
  };

  return {
    total,
    stopped,
    errors,
    smsReplies,
    emailReplies,
    replied,
    inProgress,
    sentToday,
    sold,
    deleted,
    active,
    day1,
    day2,
    day3,
    byTemplate,
    visibilityMode: getLeadVisibilityScope(context).scope,
    featureFlagState: {
      SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
    },
  };
}
