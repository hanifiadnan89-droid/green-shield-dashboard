import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authenticateDashboardLogin } from '../dashboardLogin.js';
import { createUser, getDefaultOrganization, getUserRecordById } from '../organizationUsers.js';

describe('dashboardLogin', () => {
  let tmpDir;
  let tenancyFile;
  let originalEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-dashboard-login-'));
    tenancyFile = path.join(tmpDir, 'internal-tenancy.json');
    originalEnv = {
      DASHBOARD_USERNAME: process.env.DASHBOARD_USERNAME,
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
      INTERNAL_TENANCY_FILE: process.env.INTERNAL_TENANCY_FILE,
    };
    process.env.DASHBOARD_USERNAME = 'ah-env';
    process.env.DASHBOARD_PASSWORD = 'env-password';
    process.env.INTERNAL_TENANCY_FILE = tenancyFile;
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('keeps AH env credentials as break-glass login mapped to user_ah', async () => {
    const auth = await authenticateDashboardLogin('ah-env', 'env-password');

    expect(auth.ok).toBe(true);
    expect(auth.method).toBe('env_break_glass');
    expect(auth.sessionIdentity.userId).toBe('user_ah');
    expect(auth.sessionIdentity.organizationId).toBe('org_green_shield');
    expect(getUserRecordById('user_ah').passwordHash).toBe('');
  });

  it('authenticates real users by username and email', async () => {
    const user = createUser({
      organizationId: getDefaultOrganization().id,
      username: 'login-rep',
      name: 'Login Rep',
      email: 'login.rep@example.com',
      initials: 'LR',
      role: 'sales_rep',
      status: 'active',
      password: 'login-password',
    }, 'user_ah');

    await expect(authenticateDashboardLogin('login-rep', 'login-password')).resolves.toMatchObject({
      ok: true,
      method: 'internal_user',
      sessionIdentity: {
        userId: user.id,
        organizationId: 'org_green_shield',
        role: 'sales_rep',
      },
    });
    await expect(authenticateDashboardLogin('login.rep@example.com', 'login-password')).resolves.toMatchObject({
      ok: true,
      method: 'internal_user',
      sessionIdentity: {
        userId: user.id,
      },
    });
  });

  it('returns the same generic failure for wrong, inactive, disabled, and unknown users', async () => {
    createUser({
      organizationId: getDefaultOrganization().id,
      username: 'inactive-login',
      name: 'Inactive Login',
      email: 'inactive.login@example.com',
      initials: 'IL',
      role: 'sales_rep',
      status: 'inactive',
      password: 'inactive-password',
    }, 'user_ah');
    createUser({
      organizationId: getDefaultOrganization().id,
      username: 'disabled-login',
      name: 'Disabled Login',
      email: 'disabled.login@example.com',
      initials: 'DL',
      role: 'sales_rep',
      status: 'active',
      loginEnabled: false,
      password: 'disabled-password',
    }, 'user_ah');

    const expected = { ok: false, code: 'INVALID_CREDENTIALS' };
    await expect(authenticateDashboardLogin('inactive-login', 'inactive-password')).resolves.toEqual(expected);
    await expect(authenticateDashboardLogin('disabled-login', 'disabled-password')).resolves.toEqual(expected);
    await expect(authenticateDashboardLogin('disabled-login', 'wrong-password')).resolves.toEqual(expected);
    await expect(authenticateDashboardLogin('missing-login', 'wrong-password')).resolves.toEqual(expected);
  });
});
