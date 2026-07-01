import { describe, expect, it } from 'vitest';
import {
  canViewAllUsers,
  canViewOwnData,
  hasAnyRole,
  hasCapability,
  hasRole,
  isAdminUser,
  isManagerOrAdmin,
  requireActiveUser,
  requireAdmin,
  requireManagerOrAdmin,
} from '../internalAccess.js';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
  };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

function mockReq(context) {
  return { currentUserContext: context };
}

describe('internalAccess', () => {
  const admin = {
    userId: 'u1',
    role: 'admin',
    status: 'active',
    isAdmin: true,
    isManager: false,
    isSalesRep: false,
  };
  const manager = {
    userId: 'u2',
    role: 'manager',
    status: 'active',
    isAdmin: false,
    isManager: true,
    isSalesRep: false,
  };
  const rep = {
    userId: 'u3',
    role: 'sales_rep',
    status: 'active',
    isAdmin: false,
    isManager: false,
    isSalesRep: true,
  };
  const inactiveAdmin = { ...admin, status: 'inactive' };

  it('allows active admins through requireAdmin', () => {
    const res = mockRes();
    let called = false;
    requireAdmin(mockReq(admin), res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('blocks inactive users', () => {
    const res = mockRes();
    let called = false;
    requireActiveUser(mockReq(inactiveAdmin), res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('USER_INACTIVE');
  });

  it('blocks non-admins from admin-only routes', () => {
    const res = mockRes();
    let called = false;
    requireAdmin(mockReq(rep), res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('ADMIN_REQUIRED');
  });

  it('allows manager-or-admin access for managers', () => {
    const res = mockRes();
    let called = false;
    requireManagerOrAdmin(mockReq(manager), res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('exposes capability helpers', () => {
    expect(hasRole(admin, 'admin')).toBe(true);
    expect(hasAnyRole(manager, ['manager', 'sales_rep'])).toBe(true);
    expect(isAdminUser(admin)).toBe(true);
    expect(isManagerOrAdmin(manager)).toBe(true);
    expect(hasCapability(admin, 'manage_users')).toBe(true);
    expect(hasCapability(manager, 'view_users')).toBe(true);
    expect(hasCapability(rep, 'view_users')).toBe(false);
    expect(canViewAllUsers(admin)).toBe(true);
    expect(canViewAllUsers(manager)).toBe(true);
    expect(canViewAllUsers(rep)).toBe(false);
    expect(canViewOwnData({ userId: 'u3' }, 'u3')).toBe(true);
    expect(canViewOwnData({ userId: 'u3' }, 'u2')).toBe(false);
  });
});
