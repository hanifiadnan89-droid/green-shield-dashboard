import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signSession } from '../../security/dashboardAuth.js';
import { getCurrentUserContext } from '../currentUserContext.js';
import { buildSessionIdentity, createUser, getDefaultOrganization } from '../organizationUsers.js';

describe('currentUserContext', () => {
  let tmpDir;
  let tenancyFile;
  let integrationsFile;
  let ownershipFile;
  let originalEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-current-user-'));
    tenancyFile = path.join(tmpDir, 'internal-tenancy.json');
    integrationsFile = path.join(tmpDir, 'organization-integrations.json');
    ownershipFile = path.join(tmpDir, 'lead-ownership.json');
    originalEnv = {
      DASHBOARD_USERNAME: process.env.DASHBOARD_USERNAME,
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
      INTERNAL_TENANCY_FILE: process.env.INTERNAL_TENANCY_FILE,
      ORGANIZATION_INTEGRATIONS_FILE: process.env.ORGANIZATION_INTEGRATIONS_FILE,
      LEAD_OWNERSHIP_FILE: process.env.LEAD_OWNERSHIP_FILE,
      SHEET_ID: process.env.SHEET_ID,
      GMAIL_USER: process.env.GMAIL_USER,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    };
    process.env.DASHBOARD_USERNAME = 'tester';
    process.env.DASHBOARD_PASSWORD = 'secret';
    process.env.INTERNAL_TENANCY_FILE = tenancyFile;
    process.env.ORGANIZATION_INTEGRATIONS_FILE = integrationsFile;
    process.env.LEAD_OWNERSHIP_FILE = ownershipFile;
    process.env.SHEET_ID = 'sheet_123';
    process.env.GMAIL_USER = 'tester@gshieldpest.com';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('loads the integration profile into the current user context', () => {
    const token = signSession('tester');
    const context = getCurrentUserContext({
      headers: { cookie: `gs_session=${encodeURIComponent(token)}` },
    });

    expect(context).toBeTruthy();
    expect(context.integrationProfile).toBeTruthy();
    expect(context.integrationProfile.google.masterLeadSheetId).toBe('sheet_123');
    expect(context.integrationProfile.gmail.senderEmail).toBe('tester@gshieldpest.com');
    expect(typeof context.ownsLead).toBe('function');
    expect(context.ownsLead({ row_number: 12 })).toBe(true);
    expect(context.canViewLead({ row_number: 12 })).toBe(true);
    expect(context.canEditLead({ row_number: 12 })).toBe(true);
  });

  it('resolves the actual logged-in user from session userId before legacy AH mapping', () => {
    const rep = createUser({
      organizationId: getDefaultOrganization().id,
      username: 'session-rep',
      name: 'Session Rep',
      email: 'session.rep@example.com',
      initials: 'SR',
      role: 'sales_rep',
      status: 'active',
      password: 'session-password',
    }, 'user_ah');
    const token = signSession(buildSessionIdentity(rep));
    const context = getCurrentUserContext({
      headers: { cookie: `gs_session=${encodeURIComponent(token)}` },
    });

    expect(context).toBeTruthy();
    expect(context.userId).toBe(rep.id);
    expect(context.userId).not.toBe('user_ah');
    expect(context.organizationId).toBe('org_green_shield');
    expect(context.role).toBe('sales_rep');
    expect(context.capabilities).toEqual([]);
  });

  it('rejects stale session versions after password or account changes', () => {
    const manager = createUser({
      organizationId: getDefaultOrganization().id,
      username: 'session-manager',
      name: 'Session Manager',
      email: 'session.manager@example.com',
      initials: 'SM',
      role: 'manager',
      status: 'active',
      password: 'session-password',
    }, 'user_ah');
    const token = signSession({ ...buildSessionIdentity(manager), sessionVersion: 999 });
    const context = getCurrentUserContext({
      headers: { cookie: `gs_session=${encodeURIComponent(token)}` },
    });

    expect(context).toBeNull();
  });

  it('maps env Basic Auth break-glass to user_ah without requiring username match', () => {
    getDefaultOrganization();
    process.env.DASHBOARD_USERNAME = 'rotated-env-user';
    process.env.DASHBOARD_PASSWORD = 'rotated-env-password';
    const basic = Buffer.from('rotated-env-user:rotated-env-password').toString('base64');
    const context = getCurrentUserContext({
      headers: { authorization: `Basic ${basic}` },
    });

    expect(context).toBeTruthy();
    expect(context.userId).toBe('user_ah');
    expect(context.role).toBe('admin');
  });
});
