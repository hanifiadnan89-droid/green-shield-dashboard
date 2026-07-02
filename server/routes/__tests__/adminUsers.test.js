import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import adminUsersRouter from '../adminUsers.js';
import { getUserRecordById } from '../../services/organizationUsers.js';

function createMockResponse() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      resolve(this);
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      resolve(this);
      return this;
    },
    end(payload) {
      this.body = payload;
      this.finished = true;
      resolve(this);
      return this;
    },
  };
  return { res, done };
}

async function invokeRouter({ method = 'GET', url = '/', body = null, context = null }) {
  const req = {
    method,
    url,
    path: url,
    originalUrl: url,
    headers: {},
    body,
    currentUserContext: context,
  };
  const { res, done } = createMockResponse();
  await new Promise((resolve, reject) => {
    adminUsersRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
    done.then(resolve).catch(reject);
  });
  return res;
}

describe('adminUsers router', () => {
  let tmpDir;
  let tenancyFile;
  let originalUsername;
  let originalTenancyFile;

  const adminContext = () => ({
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    name: 'Adnan / AH',
    email: 'tester',
    initials: 'AH',
    role: 'admin',
    status: 'active',
    isAdmin: true,
    isManager: false,
    isSalesRep: false,
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-admin-users-'));
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

  it('lets admin list, create, edit, deactivate, and reactivate users', async () => {
    const listRes = await invokeRouter({ method: 'GET', url: '/', context: adminContext() });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.users).toHaveLength(1);
    expect(listRes.body.organization.slug).toBe('green-shield');

    const createdRes = await invokeRouter({
      method: 'POST',
      url: '/',
      context: adminContext(),
      body: {
        username: 'jamie',
        name: 'Jamie Taylor',
        displayName: 'Jamie T',
        email: 'jamie@example.com',
        initials: 'JT',
        role: 'sales_rep',
        status: 'active',
        password: 'jamie-password',
      },
    });
    expect(createdRes.statusCode).toBe(201);
    expect(createdRes.body.user.username).toBe('jamie');
    expect(createdRes.body.user.name).toBe('Jamie Taylor');
    expect(createdRes.body.user.displayName).toBe('Jamie T');
    expect(createdRes.body.user.createdBy).toBe('user_ah');
    expect(createdRes.body.user.updatedBy).toBe('user_ah');
    expect(createdRes.body.user.passwordHash).toBeUndefined();
    expect(createdRes.body.user.hasPassword).toBe(true);

    const userId = createdRes.body.user.id;
    const getRes = await invokeRouter({ method: 'GET', url: `/${userId}`, context: adminContext() });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.user.passwordHash).toBeUndefined();

    const listAfterCreate = await invokeRouter({ method: 'GET', url: '/', context: adminContext() });
    expect(listAfterCreate.statusCode).toBe(200);
    expect(listAfterCreate.body.users.find((user) => user.id === userId).passwordHash).toBeUndefined();

    const originalHash = getUserRecordById(userId).passwordHash;
    const updatedRes = await invokeRouter({
      method: 'PUT',
      url: `/${userId}`,
      context: adminContext(),
      body: {
        username: 'jamie',
        name: 'Jamie T',
        displayName: '',
        email: 'jamie.t@example.com',
        initials: 'JT',
        role: 'manager',
        status: 'inactive',
        loginEnabled: false,
      },
    });
    expect(updatedRes.statusCode).toBe(200);
    expect(updatedRes.body.user.role).toBe('manager');
    expect(updatedRes.body.user.status).toBe('inactive');
    expect(updatedRes.body.user.loginEnabled).toBe(false);
    expect(updatedRes.body.user.updatedBy).toBe('user_ah');
    expect(updatedRes.body.user.passwordHash).toBeUndefined();

    const resetRes = await invokeRouter({
      method: 'POST',
      url: `/${userId}/reset-password`,
      context: adminContext(),
      body: { password: 'jamie-new-password' },
    });
    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.body.user.passwordHash).toBeUndefined();
    expect(getUserRecordById(userId).passwordHash).not.toBe(originalHash);

    const deactivatedRes = await invokeRouter({
      method: 'POST',
      url: `/${userId}/deactivate`,
      context: adminContext(),
    });
    expect(deactivatedRes.statusCode).toBe(200);
    expect(deactivatedRes.body.user.status).toBe('inactive');

    const reactivatedRes = await invokeRouter({
      method: 'POST',
      url: `/${userId}/reactivate`,
      context: adminContext(),
    });
    expect(reactivatedRes.statusCode).toBe(200);
    expect(reactivatedRes.body.user.status).toBe('active');
  });

  it('allows managers to view users but blocks non-managers from user admin actions', async () => {
    const managerRes = await invokeRouter({
      method: 'GET',
      url: '/',
      context: {
        ...adminContext(),
        userId: 'user_manager',
        initials: 'MG',
        role: 'manager',
        isAdmin: false,
        isManager: true,
        isSalesRep: false,
      },
    });
    expect(managerRes.statusCode).toBe(200);

    const repRes = await invokeRouter({
      method: 'GET',
      url: '/',
      context: {
        ...adminContext(),
        userId: 'user_rep',
        initials: 'SR',
        role: 'sales_rep',
        isAdmin: false,
        isManager: false,
        isSalesRep: true,
      },
    });
    expect(repRes.statusCode).toBe(403);
    expect(repRes.body.code).toBe('ADMIN_REQUIRED');
  });

  it('blocks non-admin users from creating and resetting users', async () => {
    const repContext = {
      ...adminContext(),
      userId: 'user_rep',
      initials: 'SR',
      role: 'sales_rep',
      isAdmin: false,
      isManager: false,
      isSalesRep: true,
    };
    const createRes = await invokeRouter({
      method: 'POST',
      url: '/',
      context: repContext,
      body: {
        username: 'blocked',
        name: 'Blocked User',
        email: 'blocked@example.com',
        initials: 'BU',
        role: 'sales_rep',
        status: 'active',
        password: 'blocked-password',
      },
    });
    expect(createRes.statusCode).toBe(403);
    expect(createRes.body.code).toBe('ADMIN_REQUIRED');

    const resetRes = await invokeRouter({
      method: 'POST',
      url: '/user_ah/reset-password',
      context: repContext,
      body: { password: 'blocked-password' },
    });
    expect(resetRes.statusCode).toBe(403);
    expect(resetRes.body.code).toBe('ADMIN_REQUIRED');
  });

  it('blocks inactive admins from user admin actions', async () => {
    const inactiveRes = await invokeRouter({
      method: 'GET',
      url: '/',
      context: {
        ...adminContext(),
        status: 'inactive',
      },
    });
    expect(inactiveRes.statusCode).toBe(403);
    expect(inactiveRes.body.code).toBe('USER_INACTIVE');
  });
});
