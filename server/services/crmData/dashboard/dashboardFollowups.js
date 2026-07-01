import {
  getLeadVisibilityScope,
} from '../../leadAccess.js';
import {
  daysSince,
  hasSent,
  isError,
  isReplied,
  isStopped,
} from './dashboardUtils.js';

export function buildFollowupBuckets(context, leadEntities) {
  const eligible = leadEntities.filter((lead) => hasSent(lead) && !isStopped(lead) && !isReplied(lead) && !isError(lead));

  const followupsDueList = eligible
    .map((lead) => ({
      ...lead.toJSON(),
      overdueDays: daysSince(lead.raw?.sent),
    }))
    .filter((lead) => lead.overdueDays !== null && lead.overdueDays >= 3)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 5);

  const followupsDueCount = eligible.filter((lead) => {
    const overdueDays = daysSince(lead.raw?.sent);
    return overdueDays !== null && overdueDays >= 6;
  }).length;

  return {
    followupsDueList,
    followupsDueCount,
    overdueCount: followupsDueCount,
    visibilityMode: getLeadVisibilityScope(context).scope,
  };
}
