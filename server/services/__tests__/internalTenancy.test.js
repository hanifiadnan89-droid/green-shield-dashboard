import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  createUser,
  deactivateUser,
  getDefaultOrganization,
  getInternalTenancySnapshot,
  getUserByAuthUsername,
  listUsers,
  reactivateUser,
  resolveCurrentUserContextFromAuthUsername,
  updateUser,
} from '../organizationUsers.js';

describe('organizationUsers', () => {
  let tmpDir;
  let tenancyFile;
  let originalUsername;
  let originalTenancyFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-tenancy-'));
    tenancyFile = path.join(tmpDir, 'internal-tenancy.json');
    originalUsername = process.env.DASHBOARD_USERNAME;
    originalTenancyFile = process.env.INTERNAL_TENANCY_FILE;
    process.env.DASHBOARD_USERNAME = 'tester';
    process.env.INTERNAL_TENANCY_FILE = tenancyFile;
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalUsername == null) delete process.env.DASHBOARD_USERNAME;
    else process.env.DASHBOARD_USERNAME = originalUsername;
    if (originalTenancyFile == null) delete process.env.INTERNAL_TENANCY_FILE;
    else process.env.INTERNAL_TENANCY_FILE = originalTenancyFile;
  });

  it('seeds a single organization and AH admin user', () => {
    const snapshot = getInternalTenancySnapshot();
    expect(snapshot.organizations).toHaveLength(1);
    expect(snapshot.organizations[0].slug).toBe('green-shield');
    expect(snapshot.users).toHaveLength(1);
    expect(snapshot.users[0].initials).toBe('AH');
    expect(snapshot.users[0].role).toBe('admin');
    expect(snapshot.users[0].displayName).toBe('Adnan / AH');
    expect(snapshot.users[0].createdBy).toBe('system');
    expect(snapshot.users[0].updatedBy).toBe('system');
    expect(getDefaultOrganization().slug).toBe('green-shield');
    expect(getUserByAuthUsername('tester')?.initials).toBe('AH');
  });

  it('resolves the seeded dashboard session to the admin user', () => {
    const ctx = resolveCurrentUserContextFromAuthUsername('tester');
    expect(ctx).toMatchObject({
      initials: 'AH',
      role: 'admin',
      status: 'active',
      isAdmin: true,
      isManager: false,
      isSalesRep: false,
    });
  });

  it('creates, updates, deactivates, and reactivates users', () => {
    const created = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Jamie Taylor',
      displayName: 'Jamie T',
      email: 'jamie@example.com',
      initials: 'JT',
      role: 'sales_rep',
      status: 'active',
    }, 'user_ah');
    expect(created.name).toBe('Jamie Taylor');
    expect(created.displayName).toBe('Jamie T');
    expect(created.createdBy).toBe('user_ah');
    expect(created.updatedBy).toBe('user_ah');
    expect(listUsers().some((user) => user.id === created.id)).toBe(true);

    const updated = updateUser(created.id, {
      name: 'Jamie Taylor II',
      displayName: '',
      email: 'jamie.taylor@example.com',
      initials: 'JT',
      role: 'manager',
      status: 'inactive',
    }, 'user_ah');
    expect(updated.name).toBe('Jamie Taylor II');
    expect(updated.displayName).toBe('Jamie Taylor II');
    expect(updated.role).toBe('manager');
    expect(updated.status).toBe('inactive');
    expect(updated.updatedBy).toBe('user_ah');

    const deactivated = deactivateUser(created.id, 'user_ah');
    expect(deactivated.status).toBe('inactive');

    const reactivated = reactivateUser(created.id, 'user_ah');
    expect(reactivated.status).toBe('active');
  });

  it('prevents deactivating the only active admin', () => {
    expect(() => deactivateUser('user_ah', 'user_ah')).toThrow('At least one active admin must remain in the organization.');
  });
});
