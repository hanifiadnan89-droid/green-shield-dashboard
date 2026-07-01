import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser, getDefaultOrganization } from '../../../services/organizationUsers.js';
import { assignLeadOwner } from '../../../services/leadOwnership.js';
import { Lead } from '../Lead.js';

describe('Lead domain entity', () => {
  let tmpDir;
  let originalEnv;
  let admin;
  let manager;
  let rep;
  let adminContext;
  let repContext;
  let ownedLead;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-lead-domain-'));
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
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';

    const organizationId = getDefaultOrganization().id;
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
    repContext = {
      userId: rep.id,
      organizationId,
      role: rep.role,
      status: rep.status,
      initials: rep.initials,
      email: rep.email,
    };

    const ownership = assignLeadOwner(10, repContext);
    ownedLead = {
      row_number: 10,
      name: 'Owned Lead',
      email: 'owned@example.com',
      phone: '5125551212',
      status: 'active',
      ownership,
      createdAt: '2026-06-29T08:00:00.000Z',
      updatedAt: '2026-06-29T09:00:00.000Z',
      source: 'sheet',
    };
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('classifies deleted, sold, stopped, replied, and active leads correctly', () => {
    const deleted = Lead.fromRaw({ ...ownedLead, deleted: 'yes' }, repContext);
    const sold = Lead.fromRaw({ ...ownedLead, sold: 'yes' }, repContext);
    const stopped = Lead.fromRaw({ ...ownedLead, stop: 'yes' }, repContext);
    const replied = Lead.fromRaw({ ...ownedLead, sms_reply: 'yes' }, repContext);
    const active = Lead.fromRaw({ ...ownedLead }, repContext);

    expect(deleted.computedStatus()).toBe('deleted');
    expect(deleted.displayStatus()).toBe('Deleted');
    expect(deleted.isDeleted()).toBe(true);
    expect(deleted.isActive()).toBe(false);

    expect(sold.computedStatus()).toBe('sold');
    expect(sold.displayStatus()).toBe('Sold');
    expect(sold.isSold()).toBe(true);

    expect(stopped.computedStatus()).toBe('stopped');
    expect(stopped.displayStatus()).toBe('Stopped');
    expect(stopped.isStopped()).toBe(true);

    expect(replied.computedStatus()).toBe('replied');
    expect(replied.displayStatus()).toBe('Replied');
    expect(replied.hasSmsReply()).toBe(true);
    expect(replied.hasAnyReply()).toBe(true);
    expect(replied.isActionable()).toBe(false);

    expect(active.computedStatus()).toBe('active');
    expect(active.displayStatus()).toBe('Active');
    expect(active.isActive()).toBe(true);
    expect(active.isActionable()).toBe(true);
    expect(active.needsFollowUp()).toBe(true);
  });

  it('detects email replies and chooses the best contact method', () => {
    const emailLead = Lead.fromRaw({
      ...ownedLead,
      phone: '',
      email: 'customer@example.com',
      email_reply: 'yes',
    }, repContext);
    const emailOnlyLead = Lead.fromRaw({
      ...ownedLead,
      phone: '',
      sms_reply: '',
      email_reply: '',
      email: 'customer@example.com',
    }, repContext);
    const noContactLead = Lead.fromRaw({
      ...ownedLead,
      phone: '',
      email: '',
      sms_reply: '',
      email_reply: '',
    }, repContext);

    expect(emailLead.hasEmailReply()).toBe(true);
    expect(emailLead.hasAnyReply()).toBe(true);
    expect(emailLead.bestContactMethod()).toBe('email');
    expect(emailOnlyLead.hasEmail()).toBe(true);
    expect(emailOnlyLead.bestContactMethod()).toBe('email');
    expect(noContactLead.bestContactMethod()).toBe('none');
    expect(noContactLead.needsFollowUp()).toBe(false);
  });

  it('exposes ownership and visibility metadata and preserves raw fields in toJSON', () => {
    const lead = Lead.fromRaw({
      ...ownedLead,
      notes: 'Important lead',
    }, adminContext);
    const ownership = lead.getOwnership();
    const visibility = lead.getVisibility();
    const json = lead.toJSON();

    expect(ownership).toMatchObject({
      organizationId: getDefaultOrganization().id,
      ownerUserId: rep.id,
      createdBy: rep.id,
      updatedBy: rep.id,
    });
    expect(visibility).toMatchObject({
      canView: true,
      canEdit: true,
      scope: 'organization',
    });
    expect(json).toMatchObject({
      row_number: 10,
      name: 'Owned Lead',
      email: 'owned@example.com',
      notes: 'Important lead',
      ownership,
      visibility,
      normalizedStatus: 'active',
      computedStatus: 'active',
      displayStatus: 'Active',
      bestContactMethod: 'sms',
    });
  });
});
