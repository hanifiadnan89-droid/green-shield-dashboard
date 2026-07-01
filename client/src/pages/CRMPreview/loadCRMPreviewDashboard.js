import { api } from '../../api/client.js';
import { deriveStats } from './mockData.js';

export async function loadCRMPreviewDashboard(apiClient = api) {
  try {
    const dashboard = await apiClient.dashboard.get();
    const leads = Array.isArray(dashboard?.leads) ? dashboard.leads : [];
    return {
      source: 'dashboard',
      leads,
      stats: dashboard?.stats || null,
      pipelineMetrics: dashboard?.pipelineMetrics || null,
    };
  } catch (dashboardErr) {
    try {
      const { leads: data } = await apiClient.leads.list();
      const leads = Array.isArray(data) ? data : [];
      return {
        source: 'leads',
        leads,
        stats: deriveStats(leads),
        pipelineMetrics: null,
        dashboardError: dashboardErr,
      };
    } catch (leadsErr) {
      throw Object.assign(leadsErr, {
        dashboardError: dashboardErr,
      });
    }
  }
}
