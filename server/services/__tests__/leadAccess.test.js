import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser, getDefaultOrganization } from '../organizationUsers.js';
import { assignLeadOwner } from '../leadOwnership.js';
import {
  assertCanEditLead,
  assertCanViewLead,
  canEditLead,
  canViewLead,
  filterLeadsForUser,
  getLeadVisibilityScope,
  isScopedLeadAccessEnabled,
} from '../leadAccess.js';

describe('leadAccess', () => {
  let tmpDir;
  let originalEnv;
  let admin;
  let manager;
  let rep;
  let inactive;
  let adminContext;
  let managerContext;
  let repContext;
  let inactiveContext;
  let ownedLead;
  let otherLead;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-lead-access-'));
    originalEnv = {
      DASHBOARD_USERNAME: process.env.DASHBOARD_USERNAME,
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
      INTERNAL_TENANCY_FILE: process.env.INTERNAL_TENANCY_FILE,
      LEAD_OWNERSHIP_FILE: process.env.LEAD_OWNERSHIP_FILE,
      SCOPED_LEAD_ACCESS_ENABLED: process.env.SCOPED_LEAD_ACCESS_ENABLED,
    };
    process.env.DASHBOARD_USERNAME = 'tester';
    process.env.DASHBOARD_PASSWORD = 'secret';
    process.env.INTERNAL_TENANCY_FILE = path.join(tmpDir, 'internal-tenancy.json');
    process.env.LEAD_OWNERSHIP_FILE = path.join(tmpDir, 'lead-ownership.json');
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'false';

    admin = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Admin User',
      displayName: 'Admin User',
      email: 'admin@example.com',
      initials: 'AD',
      role: 'admin',
      status: 'active',
    }, 'user_ah');
    manager = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Manager User',
      displayName: 'Manager User',
      email: 'manager@example.com',
      initials: 'MG',
      role: 'manager',
      status: 'active',
    }, 'user_ah');
    rep = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Sales Rep',
      displayName: 'Sales Rep',
      email: 'rep@example.com',
      initials: 'SR',
      role: 'sales_rep',
      status: 'active',
    }, 'user_ah');
    inactive = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Inactive Rep',
      displayName: 'Inactive Rep',
      email: 'inactive@example.com',
      initials: 'IN',
      role: 'sales_rep',
      status: 'inactive',
    }, 'user_ah');

    adminContext = {
      userId: admin.id,
      organizationId: admin.organizationId,
      role: admin.role,
      status: admin.status,
    };
    managerContext = {
      userId: manager.id,
      organizationId: manager.organizationId,
      role: manager.role,
      status: manager.status,
    };
    repContext = {
      userId: rep.id,
      organizationId: rep.organizationId,
      role: rep.role,
      status: rep.status,
    };
    inactiveContext = {
      userId: inactive.id,
      organizationId: inactive.organizationId,
      role: inactive.role,
      status: inactive.status,
    };

    assignLeadOwner(10, {
      userId: rep.id,
      organizationId: getDefaultOrganization().id,
    });
    ownedLead = {
      row_number: 10,
      organizationId: getDefaultOrganization().id,
      ownerUserId: rep.id,
      createdBy: rep.id,
      updatedBy: rep.id,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
      source: 'store',
      name: 'Owned Lead',
    };
    otherLead = {
      row_number: 11,
      organizationId: getDefaultOrganization().id,
      ownerUserId: manager.id,
      createdBy: manager.id,
      updatedBy: manager.id,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
      source: 'store',
      name: 'Other Lead',
    };
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('reports inactive users as unable to view or edit leads', () => {
    expect(getLeadVisibilityScope(inactiveContext)).toMatchObject({
      scope: 'inactive',
      canViewAll: false,
      canEditAll: false,
    });
    expect(canViewLead(inactiveContext, ownedLead)).toBe(false);
    expect(canEditLead(inactiveContext, ownedLead)).toBe(false);
    expect(() => assertCanViewLead(inactiveContext, ownedLead)).toThrow('Lead access denied.');
    expect(() => assertCanEditLead(inactiveContext, ownedLead)).toThrow('Lead edit access denied.');
  });

  it('allows admin and manager to access organization leads', () => {
    expect(getLeadVisibilityScope(adminContext)).toMatchObject({
      scope: 'organization',
      canViewAll: true,
      canEditAll: true,
    });
    expect(canViewLead(adminContext, otherLead)).toBe(true);
    expect(canEditLead(adminContext, otherLead)).toBe(true);
    expect(canViewLead(managerContext, otherLead)).toBe(true);
    expect(canEditLead(managerContext, otherLead)).toBe(true);
  });

  it('keeps flag-off behavior unfiltered while still attaching visibility metadata', () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'false';
    const leads = filterLeadsForUser(repContext, [ownedLead, otherLead]);
    expect(isScopedLeadAccessEnabled()).toBe(false);
    expect(leads).toHaveLength(2);
    expect(leads[0]).toHaveProperty('ownership');
    expect(leads[0]).toHaveProperty('visibility');
    expect(leads[0].visibility).toMatchObject({ scope: 'owned' });
    expect(leads[1].visibility).toMatchObject({ scope: 'owned' });
  });

  it('filters sales reps to owned leads when scoped access is enabled', () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';
    const leads = filterLeadsForUser(repContext, [ownedLead, otherLead]);
    expect(isScopedLeadAccessEnabled()).toBe(true);
    expect(leads).toHaveLength(1);
    expect(leads[0].row_number).toBe(10);
    expect(leads[0].visibility).toMatchObject({
      canView: true,
      canEdit: true,
      scope: 'owned',
    });
  });

  it('allows admin and manager to see all organization leads when scoped access is enabled', () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';
    expect(filterLeadsForUser(adminContext, [ownedLead, otherLead])).toHaveLength(2);
    expect(filterLeadsForUser(managerContext, [ownedLead, otherLead])).toHaveLength(2);
  });
});
