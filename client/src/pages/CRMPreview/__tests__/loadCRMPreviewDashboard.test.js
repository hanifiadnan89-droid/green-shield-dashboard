import { describe, expect, it, vi } from 'vitest';
import { loadCRMPreviewDashboard } from '../loadCRMPreviewDashboard.js';

describe('loadCRMPreviewDashboard', () => {
  it('prefers the dashboard API payload when available', async () => {
    const apiClient = {
      dashboard: {
        get: vi.fn().mockResolvedValue({
          leads: [{ row_number: 1 }],
          stats: { total: 1 },
          pipelineMetrics: { statusTotal: 1 },
        }),
      },
      leads: {
        list: vi.fn(),
      },
    };

    const result = await loadCRMPreviewDashboard(apiClient);

    expect(apiClient.dashboard.get).toHaveBeenCalledTimes(1);
    expect(apiClient.leads.list).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      source: 'dashboard',
      leads: [{ row_number: 1 }],
      stats: { total: 1 },
      pipelineMetrics: { statusTotal: 1 },
    });
  });

  it('falls back to the existing leads list when the dashboard API fails', async () => {
    const dashboardErr = new Error('dashboard failed');
    const apiClient = {
      dashboard: {
        get: vi.fn().mockRejectedValue(dashboardErr),
      },
      leads: {
        list: vi.fn().mockResolvedValue({
          leads: [
            {
              row_number: 2,
              name: 'Fallback Lead',
              sent: '2026-06-29T00:00:00.000Z',
              status: 'active',
            },
          ],
        }),
      },
    };

    const result = await loadCRMPreviewDashboard(apiClient);

    expect(apiClient.dashboard.get).toHaveBeenCalledTimes(1);
    expect(apiClient.leads.list).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      source: 'leads',
      leads: [{ row_number: 2, name: 'Fallback Lead' }],
      stats: expect.objectContaining({
        total: 1,
      }),
      pipelineMetrics: null,
      dashboardError: dashboardErr,
    });
  });
});
