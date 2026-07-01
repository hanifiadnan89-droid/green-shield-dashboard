import { describe, expect, it } from 'vitest';
import { derivePipelineDashboard } from '../derivePipelineDashboard.js';
import { resolvePipelineDashboardData } from '../resolvePipelineDashboardData.js';

describe('resolvePipelineDashboardData', () => {
  it('prefers backend pipeline metrics when the dashboard API provides them', () => {
    const backendMetrics = {
      statusTotal: 5,
      conversionRate: 42,
      todayActivity: [],
    };

    expect(resolvePipelineDashboardData({
      leads: [{ row_number: 1 }],
      stats: { total: 1 },
      pipelineMetrics: backendMetrics,
    })).toBe(backendMetrics);
  });

  it('falls back to the legacy client calculator when pipeline metrics are missing', () => {
    const leads = [
      {
        row_number: 1,
        name: 'Lead One',
        notes: 'ag',
        sent: '2026-06-29T08:00:00.000Z',
        status: 'active',
      },
    ];
    const stats = { total: 1, sold: 0, replied: 0, inProgress: 1, errors: 0, byTemplate: { ag: 1 } };

    expect(resolvePipelineDashboardData({ leads, stats })).toEqual(derivePipelineDashboard(leads, stats));
  });
});
