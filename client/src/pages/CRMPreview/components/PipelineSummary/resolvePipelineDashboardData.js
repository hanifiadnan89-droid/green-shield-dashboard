import { derivePipelineDashboard } from './derivePipelineDashboard.js';

export function resolvePipelineDashboardData({ leads = [], stats = {}, pipelineMetrics = null } = {}) {
  return pipelineMetrics ?? derivePipelineDashboard(leads, stats);
}
