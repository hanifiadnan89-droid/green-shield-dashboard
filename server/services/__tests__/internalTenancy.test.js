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
  getUserByLoginIdentifier,
  getUserRecordById,
  listUsers,
  reactivateUser,
  resetUserPassword,
  resolveCurrentUserContextFromAuthUsername,
  updateUser,
  verifyInternalUserPassword,
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
      username: 'jamie',
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
      username: 'jamie2',
      displayName: '',
      email: 'jamie.taylor@example.com',
      initials: 'JT',
      role: 'manager',
      status: 'inactive',
    }, 'user_ah');
    expect(updated.name).toBe('Jamie Taylor II');
    expect(updated.username).toBe('jamie2');
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

  it('stores hashed passwords only and never returns passwordHash', async () => {
    const created = createUser({
      organizationId: getDefaultOrganization().id,
      username: 'rep1',
      name: 'Sales Rep',
      email: 'rep1@example.com',
      initials: 'R1',
      role: 'sales_rep',
      status: 'active',
      password: 'rep-password-1',
    }, 'user_ah');

    expect(created.passwordHash).toBeUndefined();
    expect(created.hasPassword).toBe(true);
    expect(getUserByLoginIdentifier('rep1').passwordHash).toBeUndefined();
    expect(getUserByLoginIdentifier('rep1@example.com').id).toBe(created.id);

    const stored = getUserRecordById(created.id);
    expect(stored.passwordHash).toBeTruthy();
    expect(stored.passwordHash).not.toBe('rep-password-1');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);

    const raw = JSON.parse(fs.readFileSync(tenancyFile, 'utf8'));
    expect(raw.users.find((user) => user.id === created.id).passwordHash).toBe(stored.passwordHash);
  });

  it('authenticates internal users by username and email with generic failures', async () => {
    const created = createUser({
      organizationId: getDefaultOrganization().id,
      username: 'rep-login',
      name: 'Rep Login',
      email: 'rep.login@example.com',
      initials: 'RL',
      role: 'sales_rep',
      status: 'active',
      password: 'rep-password-2',
    }, 'user_ah');

    const byUsername = await verifyInternalUserPassword('rep-login', 'rep-password-2');
    expect(byUsername.ok).toBe(true);
    expect(byUsername.sessionIdentity.userId).toBe(created.id);

    const byEmail = await verifyInternalUserPassword('rep.login@example.com', 'rep-password-2');
    expect(byEmail.ok).toBe(true);
    expect(byEmail.sessionIdentity.organizationId).toBe(getDefaultOrganization().id);

    await expect(verifyInternalUserPassword('rep-login', 'wrong-password')).resolves.toMatchObject({
      ok: false,
      code: 'INVALID_CREDENTIALS',
    });
    await expect(verifyInternalUserPassword('missing-user', 'wrong-password')).resolves.toMatchObject({
      ok: false,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects inactive and login-disabled users', async () => {
    const inactive = createUser({
      organizationId: getDefaultOrganization().id,
      username: 'inactive-rep',
      name: 'Inactive Rep',
      email: 'inactive@example.com',
      initials: 'IR',
      role: 'sales_rep',
      status: 'inactive',
      password: 'inactive-password',
    }, 'user_ah');
    const disabled = createUser({
      organizationId: getDefaultOrganization().id,
      username: 'disabled-rep',
      name: 'Disabled Rep',
      email: 'disabled@example.com',
      initials: 'DR',
      role: 'sales_rep',
      status: 'active',
      loginEnabled: false,
      password: 'disabled-password',
    }, 'user_ah');

    await expect(verifyInternalUserPassword(inactive.username, 'inactive-password')).resolves.toMatchObject({
      ok: false,
      code: 'INVALID_CREDENTIALS',
    });
    await expect(verifyInternalUserPassword(disabled.username, 'disabled-password')).resolves.toMatchObject({
      ok: false,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('resets passwords with a new hash and bumps sessionVersion', () => {
    const created = createUser({
      organizationId: getDefaultOrganization().id,
      username: 'reset-rep',
      name: 'Reset Rep',
      email: 'reset@example.com',
      initials: 'RR',
      role: 'sales_rep',
      status: 'active',
      password: 'old-password',
    }, 'user_ah');
    const before = getUserRecordById(created.id);
    const reset = resetUserPassword(created.id, 'new-password', 'user_ah');
    const after = getUserRecordById(created.id);

    expect(reset.passwordHash).toBeUndefined();
    expect(after.passwordHash).toBeTruthy();
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
  });
});
