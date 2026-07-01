import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getVisibleLeads: vi.fn(),
  getLeads: vi.fn(),
}));

vi.mock('../leadQueries.js', () => ({
  getVisibleLeads: mocks.getVisibleLeads,
}));

vi.mock('../../sheets.js', () => ({
  getLeads: mocks.getLeads,
}));

import {
  getDashboardData,
  getDashboardFollowups,
  getDashboardLeadMetrics,
  getDashboardPipelineMetrics,
  getDashboardSummary,
} from '../dashboardQueries.js';

describe('crmData dashboardQueries', () => {
  let originalFlag;
  let originalNodeEnv;
  let adminContext;
  let managerContext;
  let repContext;
  let leads;

  beforeEach(() => {
    originalFlag = process.env.SCOPED_LEAD_ACCESS_ENABLED;
    originalNodeEnv = process.env.NODE_ENV;

    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'false';
    process.env.NODE_ENV = 'test';

    adminContext = {
      userId: 'user_ah',
      organizationId: 'org_green_shield',
      role: 'admin',
      status: 'active',
      initials: 'AH',
      name: 'Adnan / AH',
    };
    managerContext = {
      userId: 'user_manager',
      organizationId: 'org_green_shield',
      role: 'manager',
      status: 'active',
      initials: 'MG',
      name: 'Manager User',
    };
    repContext = {
      userId: 'user_rep',
      organizationId: 'org_green_shield',
      role: 'sales_rep',
      status: 'active',
      initials: 'SR',
      name: 'Sales Rep',
    };

    leads = [
      {
        row_number: 10,
        name: 'Sold Lead',
        email: 'sold@example.com',
        phone: '5125551000',
        notes: 'ag',
        sent: '2026-06-28T10:00:00.000Z',
        sold: 'yes',
        status: 'active',
        ownership: {
          organizationId: 'org_green_shield',
          ownerUserId: 'user_rep',
          createdBy: 'user_rep',
          updatedBy: 'user_rep',
          createdAt: '2026-06-28T09:00:00.000Z',
          updatedAt: '2026-06-28T10:00:00.000Z',
          source: 'store',
        },
      },
      {
        row_number: 11,
        name: 'Stopped Lead',
        email: 'stop@example.com',
        phone: '5125551001',
        notes: 'na',
        sent: '2026-06-27T10:00:00.000Z',
        stop: 'yes',
        status: 'stopped',
        ownership: {
          organizationId: 'org_green_shield',
          ownerUserId: 'user_manager',
          createdBy: 'user_manager',
          updatedBy: 'user_manager',
          createdAt: '2026-06-27T09:00:00.000Z',
          updatedAt: '2026-06-27T10:00:00.000Z',
          source: 'store',
        },
      },
      {
        row_number: 12,
        name: 'Replied Lead',
        email: 'reply@example.com',
        phone: '5125551002',
        notes: 'rit',
        sent: '2026-06-29T08:00:00.000Z',
        sms_reply: 'yes',
        status: 'replied',
        ownership: {
          organizationId: 'org_green_shield',
          ownerUserId: 'user_rep',
          createdBy: 'user_rep',
          updatedBy: 'user_rep',
          createdAt: '2026-06-29T07:00:00.000Z',
          updatedAt: '2026-06-29T08:00:00.000Z',
          source: 'store',
        },
      },
      {
        row_number: 13,
        name: 'Deleted Lead',
        email: 'deleted@example.com',
        phone: '5125551003',
        notes: 'tm',
        sent: '2026-06-25T08:00:00.000Z',
        deleted: 'yes',
        status: 'active',
        ownership: {
          organizationId: 'org_green_shield',
          ownerUserId: 'user_rep',
          createdBy: 'user_rep',
          updatedBy: 'user_rep',
          createdAt: '2026-06-25T07:00:00.000Z',
          updatedAt: '2026-06-25T08:00:00.000Z',
          source: 'store',
        },
      },
      {
        row_number: 14,
        name: 'Followup Lead',
        email: 'followup@example.com',
        phone: '5125551004',
        notes: 'iq',
        sent: '2026-06-20T08:00:00.000Z',
        status: 'active',
        ownership: {
          organizationId: 'org_green_shield',
          ownerUserId: 'user_manager',
          createdBy: 'user_manager',
          updatedBy: 'user_manager',
          createdAt: '2026-06-20T07:00:00.000Z',
          updatedAt: '2026-06-20T08:00:00.000Z',
          source: 'store',
        },
      },
      {
        row_number: 15,
        name: 'Errored Lead',
        email: 'error@example.com',
        phone: '5125551005',
        notes: 'iq',
        sent: '2026-06-21T08:00:00.000Z',
        error: 'Provider error',
        status: 'error',
        ownership: {
          organizationId: 'org_green_shield',
          ownerUserId: 'user_rep',
          createdBy: 'user_rep',
          updatedBy: 'user_rep',
          createdAt: '2026-06-21T07:00:00.000Z',
          updatedAt: '2026-06-21T08:00:00.000Z',
          source: 'store',
        },
      },
    ];

    mocks.getVisibleLeads.mockReset();
    mocks.getLeads.mockReset();
    mocks.getVisibleLeads.mockImplementation(async (context) => {
      const scopedRep = process.env.SCOPED_LEAD_ACCESS_ENABLED === 'true' && context?.role === 'sales_rep';
      return scopedRep
        ? leads.filter((lead) => lead.ownership.ownerUserId === context.userId)
        : leads;
    });
  });

  afterEach(() => {
    if (originalFlag == null) delete process.env.SCOPED_LEAD_ACCESS_ENABLED;
    else process.env.SCOPED_LEAD_ACCESS_ENABLED = originalFlag;
    if (originalNodeEnv == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('uses leadQueries for dashboard data and does not reach sheets directly', async () => {
    const dashboard = await getDashboardData(adminContext);

    expect(mocks.getVisibleLeads).toHaveBeenCalledWith(adminContext);
    expect(mocks.getLeads).not.toHaveBeenCalled();
    expect(dashboard).toMatchObject({
      count: 6,
      stats: {
        total: 6,
        sold: 1,
        stopped: 1,
        replied: 1,
        deleted: 1,
        errors: 1,
      },
      summary: {
        totalLeads: 6,
        soldLeads: 1,
        stoppedLeads: 1,
        repliedLeads: 1,
        deletedLeads: 1,
        errors: 1,
        followupsDue: 1,
      },
    });
    expect(Array.isArray(dashboard.activity)).toBe(true);
    expect(dashboard.pipelineMetrics).toMatchObject({
      statusTotal: 6,
      healthScore: expect.any(Number),
      conversionRate: expect.any(Number),
    });
  });

  it('matches the current dashboard summary when scoped access is disabled', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'false';

    const summary = await getDashboardSummary(adminContext);
    const metrics = await getDashboardLeadMetrics(adminContext);
    const pipeline = await getDashboardPipelineMetrics(adminContext);
    const followups = await getDashboardFollowups(adminContext);

    expect(summary).toMatchObject({
      totalLeads: 6,
      activeLeads: 3,
      repliedLeads: 1,
      soldLeads: 1,
      stoppedLeads: 1,
      deletedLeads: 1,
      errors: 1,
      followupsDue: 1,
      visibilityMode: 'organization',
      featureFlagState: {
        SCOPED_LEAD_ACCESS_ENABLED: false,
      },
    });
    expect(metrics).toMatchObject({
      total: 6,
      sold: 1,
      stopped: 1,
      replied: 1,
      deleted: 1,
      errors: 1,
      active: 3,
      visibilityMode: 'organization',
    });
    expect(pipeline).toMatchObject({
      statusTotal: 6,
      followupsDueCount: 1,
      repliesTotal: 1,
      conversionRate: 17,
    });
    expect(followups).toMatchObject({
      followupsDueCount: 1,
      overdueCount: 1,
    });
    expect(pipeline.todayActivity.length).toBeGreaterThan(0);
  });

  it('scopes sales rep dashboards to owned leads when the flag is enabled', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';

    const dashboard = await getDashboardData(repContext);

    expect(dashboard.count).toBe(4);
    expect(dashboard.stats).toMatchObject({
      total: 4,
      sold: 1,
      replied: 1,
      deleted: 1,
      errors: 1,
      stopped: 0,
      visibilityMode: 'owned',
      featureFlagState: {
        SCOPED_LEAD_ACCESS_ENABLED: true,
      },
    });
    expect(dashboard.summary).toMatchObject({
      totalLeads: 4,
      soldLeads: 1,
      repliedLeads: 1,
      deletedLeads: 1,
      stoppedLeads: 0,
      errors: 1,
      visibilityMode: 'owned',
    });
    expect(dashboard.pipelineMetrics.statusTotal).toBe(4);
  });

  it('keeps manager and admin dashboards organization-wide when the flag is enabled', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';

    const adminDashboard = await getDashboardData(adminContext);
    const managerDashboard = await getDashboardData(managerContext);

    expect(adminDashboard.count).toBe(6);
    expect(managerDashboard.count).toBe(6);
    expect(adminDashboard.summary.totalLeads).toBe(6);
    expect(managerDashboard.summary.totalLeads).toBe(6);
    expect(adminDashboard.stats.visibilityMode).toBe('organization');
    expect(managerDashboard.stats.visibilityMode).toBe('organization');
  });

  it('uses Lead domain rules for sold, stopped, replied, deleted, and follow-up counts', async () => {
    const dashboard = await getDashboardData(adminContext);

    expect(dashboard.stats).toMatchObject({
      sold: 1,
      stopped: 1,
      replied: 1,
      deleted: 1,
      errors: 1,
      inProgress: 3,
    });
    expect(dashboard.pipelineMetrics.metrics).toMatchObject({
      sold: 1,
      replied: 1,
      errors: 1,
      inProgress: 3,
    });
    expect(dashboard.pipelineMetrics.followupsDueCount).toBe(1);
    expect(dashboard.pipelineMetrics.todayActivity.length).toBeGreaterThan(0);
  });
});
