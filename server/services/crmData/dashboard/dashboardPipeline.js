import { getLeadVisibilityScope, isScopedLeadAccessEnabled } from '../../leadAccess.js';
import { buildDailySeries, buildTemplatePerformance } from './dashboardCharts.js';
import { buildLeadActivitySeries, buildTodayActivity, buildPriorityLeads } from './dashboardActivity.js';
import { buildHealthChecks, buildHealthScore } from './dashboardHealth.js';
import {
  hasSent,
  isError,
  isReplied,
  isStopped,
  templateKey,
  trendPct,
  countInRange,
} from './dashboardUtils.js';

export function buildPipelineMetrics(context, leadEntities, leadMetrics, followups) {
  const today = new Date().toDateString();
  const total = leadMetrics.total;
  const replied = leadMetrics.replied;
  const sold = leadMetrics.sold;
  const inProgress = leadMetrics.inProgress;
  const sentToday = leadMetrics.sentToday;
  const byTemplate = leadMetrics.byTemplate;
  const contacted = leadEntities.filter((lead) => hasSent(lead)).length;
  const pendingQuotes = leadEntities.filter((lead) => {
    const key = templateKey(lead);
    return ['rit', 'tm', 'iq'].includes(key) && hasSent(lead) && !isReplied(lead) && !isStopped(lead) && !isError(lead);
  }).length;

  const repliesToday = leadEntities.filter((lead) => isReplied(lead) && lead.raw?.sent && new Date(lead.raw.sent).toDateString() === today).length;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const prevWeekStart = new Date(now);
  prevWeekStart.setDate(prevWeekStart.getDate() - 14);

  const kpis = [
    {
      id: 'total',
      label: 'Total Leads',
      value: total,
      href: '/leads',
      icon: 'users',
      trend: trendPct(
        countInRange(leadEntities, weekStart, now, () => true, (lead) => lead.raw?.sent ?? null),
        countInRange(leadEntities, prevWeekStart, weekStart, () => true, (lead) => lead.raw?.sent ?? null),
      ),
      spark: buildDailySeries(leadEntities, 7, () => true, (lead) => lead.raw?.sent ?? null).points.map((point) => point.count),
    },
    {
      id: 'inProgress',
      label: 'Active Follow-ups',
      value: inProgress,
      href: '/followups',
      icon: 'send',
      trend: trendPct(
        countInRange(leadEntities, weekStart, now, (lead) => hasSent(lead) && !isReplied(lead), (lead) => lead.raw?.sent ?? null),
        countInRange(leadEntities, prevWeekStart, weekStart, (lead) => hasSent(lead) && !isReplied(lead), (lead) => lead.raw?.sent ?? null),
      ),
      spark: buildDailySeries(leadEntities, 7, (lead) => hasSent(lead) && !isReplied(lead) && !isStopped(lead), (lead) => lead.raw?.sent ?? null).points.map((point) => point.count),
    },
    {
      id: 'repliesToday',
      label: 'Replies Today',
      value: repliesToday,
      href: '/replies',
      icon: 'message',
      trend: trendPct(
        leadEntities.filter((lead) => isReplied(lead) && lead.raw?.sent && new Date(lead.raw.sent) >= weekStart).length,
        leadEntities.filter((lead) => {
          if (!isReplied(lead) || !lead.raw?.sent) return false;
          const date = new Date(lead.raw.sent);
          return date >= prevWeekStart && date < weekStart;
        }).length,
      ),
      spark: buildDailySeries(leadEntities, 7, (lead) => isReplied(lead), (lead) => lead.raw?.sent ?? null).points.map((point) => point.count),
    },
    {
      id: 'agreements',
      label: 'Agreements Sent',
      value: byTemplate.ag ?? 0,
      href: '/leads?category=sent',
      icon: 'file',
      trend: 0,
      spark: buildDailySeries(leadEntities, 7, (lead) => templateKey(lead) === 'ag', (lead) => lead.raw?.sent ?? null).points.map((point) => point.count),
    },
    {
      id: 'quotes',
      label: 'Pending Quotes',
      value: pendingQuotes,
      href: '/leads?category=inprogress',
      icon: 'dollar',
      trend: 0,
      spark: buildDailySeries(leadEntities, 7, (lead) => ['rit', 'tm', 'iq'].includes(templateKey(lead)), (lead) => lead.raw?.sent ?? null).points.map((point) => point.count),
    },
    {
      id: 'sold',
      label: 'Sold / Converted',
      value: sold,
      href: '/leads',
      icon: 'check',
      trend: (() => {
        const soldPrev = leadEntities.filter((lead) => {
          if (!lead.isSold() || !lead.raw?.sent) return false;
          const sentDate = new Date(lead.raw.sent);
          return sentDate >= prevWeekStart && sentDate < weekStart;
        }).length;

        const soldCurr = leadEntities.filter((lead) => {
          if (!lead.isSold() || !lead.raw?.sent) return false;
          return new Date(lead.raw.sent) >= weekStart;
        }).length;

        return trendPct(soldCurr, soldPrev) || (total === 0 ? -100 : 0);
      })(),
      spark: buildDailySeries(leadEntities, 7, (lead) => lead.isSold(), (lead) => lead.raw?.sent ?? null).points.map((point) => point.count),
    },
  ];

  const services = [
    {
      id: 'rit',
      label: 'Rodent & Insect Triennial',
      shortLabel: 'RIT',
      count: byTemplate.rit ?? 0,
      color: '#2563EB',
    },
    {
      id: 'tm',
      label: 'Tick & Mosquito',
      shortLabel: 'T/M',
      count: byTemplate.tm ?? 0,
      color: '#ec4899',
    },
    {
      id: 'iq',
      label: 'Insect Quarterly',
      shortLabel: 'IQ',
      count: byTemplate.iq ?? 0,
      color: '#9333EA',
    },
  ];

  const pipelineFlow = [
    { key: 'new', label: 'New Leads', count: total, color: '#22d3ee' },
    { key: 'contacted', label: 'Contacted', count: contacted, color: '#4ade80' },
    { key: 'followup', label: 'In Follow-up', count: inProgress, color: '#a3e635' },
    { key: 'quotes', label: 'Quotes', count: pendingQuotes, color: '#c084fc' },
    { key: 'converted', label: 'Converted', count: sold, color: '#fb923c' },
  ];

  const conversionRate = total > 0 ? Math.round((sold / total) * 100) : 0;

  const soldPrev = leadEntities.filter((lead) => {
    if (!lead.isSold() || !lead.raw?.sent) return false;
    const sentDate = new Date(lead.raw.sent);
    return sentDate >= prevWeekStart && sentDate < weekStart;
  }).length;

  const soldCurr = leadEntities.filter((lead) => {
    if (!lead.isSold() || !lead.raw?.sent) return false;
    return new Date(lead.raw.sent) >= weekStart;
  }).length;

  const conversionTrend = trendPct(soldCurr, soldPrev) || (conversionRate === 0 ? -100 : 0);

  const leadActivity = buildLeadActivitySeries(leadEntities, 7);
  const repliesSeries = buildDailySeries(leadEntities, 7, (lead) => isReplied(lead), (lead) => lead.raw?.sent ?? null);
  const repliesTotal = replied;
  const repliesPrevWeek = leadEntities.filter((lead) => isReplied(lead) && lead.raw?.sent && new Date(lead.raw.sent) >= prevWeekStart && new Date(lead.raw.sent) < weekStart).length;
  const repliesCurrWeek = leadEntities.filter((lead) => isReplied(lead) && lead.raw?.sent && new Date(lead.raw.sent) >= weekStart).length;
  const repliesTrend = trendPct(repliesCurrWeek, repliesPrevWeek);
  const overdueCount = followups.overdueCount;
  const errorsCount = leadMetrics.errors;
  const healthChecks = buildHealthChecks({ overdueCount, inProgress, errorsCount, replied });
  const healthScore = buildHealthScore(healthChecks);
  const priority = buildPriorityLeads(leadEntities);
  const todayActivity = buildTodayActivity(leadEntities, priority);
  const templatePerformance = buildTemplatePerformance(byTemplate);

  return {
    kpis,
    services,
    pipelineFlow,
    conversionRate,
    conversionTrend,
    leadActivity,
    followupsDueList: followups.followupsDueList,
    followupsDueCount: followups.followupsDueCount,
    templatePerformance,
    maxTemplate: Math.max(...templatePerformance.map((item) => item.count), 1),
    repliesSeries,
    repliesTotal,
    repliesTrend,
    healthChecks,
    healthScore,
    todayActivity,
    sentToday,
    statusTotal: total,
    metrics: {
      total,
      replied,
      inProgress,
      errors: errorsCount,
      sold,
    },
    visibilityMode: getLeadVisibilityScope(context).scope,
    featureFlagState: {
      SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
    },
  };
}
