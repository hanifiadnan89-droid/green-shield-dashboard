import { getVisibleLeads } from '../leadQueries.js';
import { buildLeadEntities } from './dashboardUtils.js';
import { buildLeadMetrics } from './dashboardMetrics.js';
import { buildFollowupBuckets } from './dashboardFollowups.js';
import { buildPipelineMetrics } from './dashboardPipeline.js';

async function buildDashboardBundle(context) {
  const visibleLeads = await getVisibleLeads(context);
  const leadEntities = buildLeadEntities(context, visibleLeads);
  const leadJSON = leadEntities.map((lead) => lead.toJSON());
  const leadMetrics = buildLeadMetrics(context, leadEntities);
  const followups = buildFollowupBuckets(context, leadEntities);
  const pipelineMetrics = buildPipelineMetrics(context, leadEntities, leadMetrics, followups);
  const summary = {
    totalLeads: leadMetrics.total,
    activeLeads: leadMetrics.active,
    repliedLeads: leadMetrics.replied,
    soldLeads: leadMetrics.sold,
    stoppedLeads: leadMetrics.stopped,
    deletedLeads: leadMetrics.deleted,
    errors: leadMetrics.errors,
    sentToday: leadMetrics.sentToday,
    followupsDue: followups.followupsDueCount,
    visibilityMode: leadMetrics.visibilityMode,
    featureFlagState: leadMetrics.featureFlagState,
    healthScore: pipelineMetrics.healthScore,
    conversionRate: pipelineMetrics.conversionRate,
  };

  return {
    leads: leadJSON,
    leadEntities,
    leadMetrics,
    followups,
    pipelineMetrics,
    summary,
  };
}

export async function getDashboardSummary(context) {
  const bundle = await buildDashboardBundle(context);
  return bundle.summary;
}

export async function getDashboardLeadMetrics(context) {
  const bundle = await buildDashboardBundle(context);
  return bundle.leadMetrics;
}

export async function getDashboardFollowups(context) {
  const bundle = await buildDashboardBundle(context);
  return bundle.followups;
}

export async function getDashboardPipelineMetrics(context) {
  const bundle = await buildDashboardBundle(context);
  return bundle.pipelineMetrics;
}

export async function getDashboardData(context) {
  const bundle = await buildDashboardBundle(context);
  return {
    leads: bundle.leads,
    stats: bundle.leadMetrics,
    summary: bundle.summary,
    followups: bundle.followups,
    pipelineMetrics: bundle.pipelineMetrics,
    activity: bundle.pipelineMetrics.todayActivity,
    count: bundle.leads.length,
  };
}

export {
  buildDashboardBundle,
};
