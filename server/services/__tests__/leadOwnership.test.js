import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser, getDefaultOrganization } from '../organizationUsers.js';
import {
  assignLeadOwner,
  getLeadOwner,
  isLeadOwnedByUser,
  transferLeadOwnership,
  validateLeadOwnership,
} from '../leadOwnership.js';

describe('leadOwnership', () => {
  let tmpDir;
  let tenancyFile;
  let ownershipFile;
  let originalEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-lead-ownership-'));
    tenancyFile = path.join(tmpDir, 'internal-tenancy.json');
    ownershipFile = path.join(tmpDir, 'lead-ownership.json');
    originalEnv = {
      DASHBOARD_USERNAME: process.env.DASHBOARD_USERNAME,
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
      INTERNAL_TENANCY_FILE: process.env.INTERNAL_TENANCY_FILE,
      LEAD_OWNERSHIP_FILE: process.env.LEAD_OWNERSHIP_FILE,
    };
    process.env.DASHBOARD_USERNAME = 'tester';
    process.env.DASHBOARD_PASSWORD = 'secret';
    process.env.INTERNAL_TENANCY_FILE = tenancyFile;
    process.env.LEAD_OWNERSHIP_FILE = ownershipFile;
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults existing leads to AH/system ownership without changing the sheet', () => {
    const owner = getLeadOwner(17);
    expect(owner.organizationId).toBe(getDefaultOrganization().id);
    expect(owner.ownerUserId).toBe('user_ah');
    expect(owner.createdBy).toBe('system');
    expect(owner.updatedBy).toBe('system');
    expect(owner.source).toBe('default');
  });

  it('assigns new leads to the active user and records audit fields', () => {
    const ownerUser = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Jamie Taylor',
      displayName: 'Jamie T',
      email: 'jamie@example.com',
      initials: 'JT',
      role: 'sales_rep',
      status: 'active',
    }, 'user_ah');

    const ownership = assignLeadOwner(21, {
      userId: ownerUser.id,
      organizationId: getDefaultOrganization().id,
    });

    expect(ownership.rowNumber).toBe('21');
    expect(ownership.ownerUserId).toBe(ownerUser.id);
    expect(ownership.createdBy).toBe(ownerUser.id);
    expect(ownership.updatedBy).toBe(ownerUser.id);
    expect(ownership.createdAt).toBeTruthy();
    expect(ownership.updatedAt).toBeTruthy();
    expect(isLeadOwnedByUser({
      userId: ownerUser.id,
      organizationId: getDefaultOrganization().id,
    }, 21)).toBe(true);
  });

  it('transfers ownership and preserves the original creator', () => {
    const manager = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Mia Manager',
      displayName: 'Mia Manager',
      email: 'mia@example.com',
      initials: 'MM',
      role: 'manager',
      status: 'active',
    }, 'user_ah');

    const rep = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Sam Sales',
      displayName: 'Sam Sales',
      email: 'sam@example.com',
      initials: 'SS',
      role: 'sales_rep',
      status: 'active',
    }, 'user_ah');

    assignLeadOwner(22, {
      userId: manager.id,
      organizationId: getDefaultOrganization().id,
    });

    const transferred = transferLeadOwnership(22, rep.id, {
      userId: manager.id,
      organizationId: getDefaultOrganization().id,
    });

    expect(transferred.ownerUserId).toBe(rep.id);
    expect(transferred.createdBy).toBe(manager.id);
    expect(transferred.updatedBy).toBe(manager.id);
    expect(getLeadOwner(22).ownerUserId).toBe(rep.id);
  });

  it('validates ownership payloads', () => {
    expect(() => validateLeadOwnership({
      rowNumber: '',
      organizationId: getDefaultOrganization().id,
      ownerUserId: 'user_ah',
    })).toThrow('Lead row number is required.');

    expect(() => transferLeadOwnership(23, 'missing-user', {
      userId: 'user_ah',
      organizationId: getDefaultOrganization().id,
    })).toThrow('User not found in organization');
  });
});
