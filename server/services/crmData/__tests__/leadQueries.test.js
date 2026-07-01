import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser, getDefaultOrganization } from '../../organizationUsers.js';
import { assignLeadOwner } from '../../leadOwnership.js';

const mocks = vi.hoisted(() => ({
  resolveGoogleSheetsConfig: vi.fn(),
  getLeads: vi.fn(),
}));

vi.mock('../../integrationResolver.js', () => ({
  resolveGoogleSheetsConfig: mocks.resolveGoogleSheetsConfig,
}));

vi.mock('../../sheets.js', () => ({
  getLeads: mocks.getLeads,
}));

import {
  getLeadByRowNumber,
  getLeadStatistics,
  getRecentlyUpdatedLeads,
  getVisibleLeads,
  searchVisibleLeads,
} from '../leadQueries.js';

describe('crmData leadQueries', () => {
  let tmpDir;
  let originalEnv;
  let admin;
  let manager;
  let rep;
  let organizationId;
  let adminContext;
  let managerContext;
  let repContext;
  let rawLeads;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-lead-queries-'));
    originalEnv = {
      DASHBOARD_USERNAME: process.env.DASHBOARD_USERNAME,
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
      INTERNAL_TENANCY_FILE: process.env.INTERNAL_TENANCY_FILE,
      LEAD_OWNERSHIP_FILE: process.env.LEAD_OWNERSHIP_FILE,
      SCOPED_LEAD_ACCESS_ENABLED: process.env.SCOPED_LEAD_ACCESS_ENABLED,
      NODE_ENV: process.env.NODE_ENV,
    };

    process.env.DASHBOARD_USERNAME = 'tester';
    process.env.DASHBOARD_PASSWORD = 'secret';
    process.env.INTERNAL_TENANCY_FILE = path.join(tmpDir, 'internal-tenancy.json');
    process.env.LEAD_OWNERSHIP_FILE = path.join(tmpDir, 'lead-ownership.json');
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'false';
    process.env.NODE_ENV = 'test';

    organizationId = getDefaultOrganization().id;
    admin = createUser({
      organizationId,
      name: 'Admin User',
      displayName: 'Admin User',
      email: 'admin@example.com',
      initials: 'AD',
      role: 'admin',
      status: 'active',
    }, 'user_ah');
    manager = createUser({
      organizationId,
      name: 'Manager User',
      displayName: 'Manager User',
      email: 'manager@example.com',
      initials: 'MG',
      role: 'manager',
      status: 'active',
    }, 'user_ah');
    rep = createUser({
      organizationId,
      name: 'Sales Rep',
      displayName: 'Sales Rep',
      email: 'rep@example.com',
      initials: 'SR',
      role: 'sales_rep',
      status: 'active',
    }, 'user_ah');

    adminContext = {
      userId: admin.id,
      organizationId,
      role: admin.role,
      status: admin.status,
      initials: admin.initials,
      email: admin.email,
    };
    managerContext = {
      userId: manager.id,
      organizationId,
      role: manager.role,
      status: manager.status,
      initials: manager.initials,
      email: manager.email,
    };
    repContext = {
      userId: rep.id,
      organizationId,
      role: rep.role,
      status: rep.status,
      initials: rep.initials,
      email: rep.email,
    };

    assignLeadOwner(10, repContext);
    assignLeadOwner(11, managerContext);

    rawLeads = [
      {
        row_number: 10,
        name: 'Alpha Owned',
        email: 'alpha@example.com',
        notes: 'First note',
        status: 'active',
        updatedAt: '2026-06-29T10:00:00.000Z',
        createdAt: '2026-06-29T09:00:00.000Z',
        source: 'sheet',
      },
      {
        row_number: 11,
        name: 'Bravo Other',
        email: 'bravo@example.com',
        notes: 'Second note',
        status: 'replied',
        sms_reply: 'yes',
        updatedAt: '2026-06-29T11:00:00.000Z',
        createdAt: '2026-06-29T08:00:00.000Z',
        source: 'sheet',
      },
    ];

    mocks.resolveGoogleSheetsConfig.mockReset();
    mocks.getLeads.mockReset();
    mocks.resolveGoogleSheetsConfig.mockReturnValue({
      masterLeadSheetId: 'sheet-master',
      leadResponsesSheetId: 'sheet-responses',
      customerDatabaseSheetId: 'sheet-customers',
      source: 'profile',
      configured: true,
    });
    mocks.getLeads.mockResolvedValue(rawLeads);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns decorated leads and uses resolver + sheets for the shared query path', async () => {
    const leads = await getVisibleLeads(adminContext);

    expect(mocks.resolveGoogleSheetsConfig).toHaveBeenCalledWith(adminContext);
    expect(mocks.getLeads).toHaveBeenCalledWith(adminContext);
    expect(leads).toHaveLength(2);
    expect(leads[0]).toMatchObject({
      row_number: 10,
      ownership: {
        organizationId,
        ownerUserId: rep.id,
        createdBy: rep.id,
        updatedBy: rep.id,
        source: 'store',
      },
      visibility: {
        canView: true,
        canEdit: true,
        scope: 'organization',
      },
      computedStatus: 'active',
      displayStatus: 'Active',
    });
    expect(leads[0].futureSafeMetadata).toMatchObject({
      queryName: 'getVisibleLeads',
      source: 'crmData.leadQueries',
      configuredSheets: {
        source: 'profile',
        configured: true,
      },
    });
  });

  it('filters sales reps to owned leads when scoped access is enabled', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';

    const leads = await getVisibleLeads(repContext);

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      row_number: 10,
      ownership: {
        ownerUserId: rep.id,
        organizationId,
      },
      visibility: {
        canView: true,
        canEdit: true,
        scope: 'owned',
      },
    });
    expect(await getLeadByRowNumber(repContext, 11)).toBeNull();
    expect(await getLeadByRowNumber(repContext, 10)).toMatchObject({
      row_number: 10,
      visibility: {
        canView: true,
        canEdit: true,
        scope: 'owned',
      },
    });
  });

  it('keeps search, statistics, and recent queries aligned with visible leads', async () => {
    const search = await searchVisibleLeads(managerContext, 'bravo');
    const stats = await getLeadStatistics(repContext);
    const recent = await getRecentlyUpdatedLeads(adminContext, 1);

    expect(search).toHaveLength(1);
    expect(search[0].row_number).toBe(11);
    expect(stats).toMatchObject({
      total: 2,
      visible: 2,
      owned: 1,
      statusCounts: {
        active: 1,
        replied: 1,
      },
      visibilityMode: 'owned',
      featureFlagState: {
        SCOPED_LEAD_ACCESS_ENABLED: false,
      },
    });
    expect(recent).toHaveLength(1);
    expect(recent[0].row_number).toBe(11);
  });

  it('records lightweight development instrumentation for each query', async () => {
    process.env.NODE_ENV = 'development';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await getVisibleLeads(adminContext);

    expect(logSpy).toHaveBeenCalled();
    const [tag, payload] = logSpy.mock.calls[0];
    expect(tag).toBe('[crmData.leadQueries]');
    expect(JSON.parse(payload)).toMatchObject({
      queryName: 'getVisibleLeads',
      leadCount: 2,
      visibilityMode: 'organization',
      featureFlagState: {
        SCOPED_LEAD_ACCESS_ENABLED: false,
      },
    });

    logSpy.mockRestore();
  });
});
