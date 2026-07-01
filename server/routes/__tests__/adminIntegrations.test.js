import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser, getDefaultOrganization } from '../../services/organizationUsers.js';
import adminIntegrationsRouter from '../adminIntegrations.js';

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
    adminIntegrationsRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
    done.then(resolve).catch(reject);
  });
  return res;
}

describe('adminIntegrations router', () => {
  let tmpDir;
  let tenancyFile;
  let integrationsFile;
  let originalEnv;

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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-admin-integrations-'));
    tenancyFile = path.join(tmpDir, 'internal-tenancy.json');
    integrationsFile = path.join(tmpDir, 'organization-integrations.json');
    originalEnv = {
      DASHBOARD_USERNAME: process.env.DASHBOARD_USERNAME,
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
      INTERNAL_TENANCY_FILE: process.env.INTERNAL_TENANCY_FILE,
      ORGANIZATION_INTEGRATIONS_FILE: process.env.ORGANIZATION_INTEGRATIONS_FILE,
      SHEET_ID: process.env.SHEET_ID,
      GMAIL_USER: process.env.GMAIL_USER,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
      TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
    };
    process.env.DASHBOARD_USERNAME = 'tester';
    process.env.DASHBOARD_PASSWORD = 'secret';
    process.env.INTERNAL_TENANCY_FILE = tenancyFile;
    process.env.ORGANIZATION_INTEGRATIONS_FILE = integrationsFile;
    process.env.SHEET_ID = 'sheet_123';
    process.env.GMAIL_USER = 'ah@gshieldpest.com';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG1234567890';
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('lists and updates integration profiles for the organization', async () => {
    const listRes = await invokeRouter({ method: 'GET', url: '/', context: adminContext() });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.count).toBe(1);
    expect(listRes.body.profiles[0].google.masterLeadSheetId).toBe('sheet_123');

    const user = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Jamie Taylor',
      displayName: 'Jamie T',
      email: 'jamie@example.com',
      initials: 'JT',
      role: 'sales_rep',
      status: 'active',
    }, 'user_ah');

    const createRes = await invokeRouter({
      method: 'POST',
      url: '/',
      context: adminContext(),
      body: {
        userId: user.id,
        google: {
          masterLeadSheetId: 'sheet_jamie',
          leadResponsesSheetId: 'sheet_jamie_responses',
          customerDatabaseSheetId: '',
        },
        gmail: { senderEmail: 'jamie@example.com' },
        twilio: { phoneNumber: '(555) 123-4567', messagingServiceSid: 'MG1234567890' },
        future: { fieldRoutes: null, notes: 'Seeded via API' },
      },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.profile.userId).toBe(user.id);

    const updateRes = await invokeRouter({
      method: 'PUT',
      url: `/${user.id}`,
      context: adminContext(),
      body: {
        google: {
          masterLeadSheetId: 'sheet_jamie_2',
          leadResponsesSheetId: 'sheet_jamie_responses_2',
          customerDatabaseSheetId: 'sheet_customers',
        },
        gmail: { senderEmail: 'jamie.taylor@example.com' },
        twilio: { phoneNumber: '+15555550123', messagingServiceSid: 'MG1234567890' },
        future: { fieldRoutes: null, notes: 'Updated' },
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.profile.gmail.senderEmail).toBe('jamie.taylor@example.com');
  });

  it('supports the current user self-read endpoint', async () => {
    const meRes = await invokeRouter({ method: 'GET', url: '/me', context: adminContext() });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.body.profile.userId).toBe('user_ah');
  });

  it('supports health endpoints for self and other users', async () => {
    const meHealthRes = await invokeRouter({ method: 'GET', url: '/me/health', context: adminContext() });
    expect(meHealthRes.statusCode).toBe(200);
    expect(meHealthRes.body.health.googleSheets.configured).toBe(true);
    expect(meHealthRes.body.health.gmail.configured).toBe(true);

    const user = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Jamie Taylor',
      displayName: 'Jamie T',
      email: 'jamie@example.com',
      initials: 'JT',
      role: 'sales_rep',
      status: 'active',
    }, 'user_ah');
    await invokeRouter({
      method: 'POST',
      url: '/',
      context: adminContext(),
      body: {
        userId: user.id,
        google: {
          masterLeadSheetId: 'sheet_jamie',
          leadResponsesSheetId: 'sheet_jamie_responses',
          customerDatabaseSheetId: '',
        },
        gmail: { senderEmail: 'jamie@example.com' },
        twilio: { phoneNumber: '(555) 123-4567', messagingServiceSid: 'MG1234567890' },
        future: { fieldRoutes: null, notes: 'Seeded via API' },
      },
    });

    const userHealthRes = await invokeRouter({ method: 'GET', url: `/${user.id}/health`, context: adminContext() });
    expect(userHealthRes.statusCode).toBe(200);
    expect(userHealthRes.body.health.googleSheets.source).toBe('profile');
    expect(userHealthRes.body.health.twilio.configured).toBe(true);
  });

  it('rejects duplicate creation attempts', async () => {
    const createRes = await invokeRouter({
      method: 'POST',
      url: '/',
      context: adminContext(),
      body: {
        userId: 'user_ah',
        google: {
          masterLeadSheetId: 'sheet_123',
          leadResponsesSheetId: 'sheet_123',
          customerDatabaseSheetId: '',
        },
        gmail: { senderEmail: 'ah@gshieldpest.com' },
        twilio: { phoneNumber: '+15551234567', messagingServiceSid: 'MG1234567890' },
        future: { fieldRoutes: null, notes: 'Duplicate' },
      },
    });
    expect(createRes.statusCode).toBe(409);
  });
});
