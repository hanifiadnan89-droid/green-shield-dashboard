import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser, getDefaultOrganization } from '../organizationUsers.js';
import {
  createIntegrationProfile,
  ensureOrganizationIntegrations,
  getIntegrationProfile,
  listIntegrationProfiles,
  updateIntegrationProfile,
} from '../organizationIntegrations.js';

describe('organizationIntegrations', () => {
  let tmpDir;
  let tenancyFile;
  let integrationsFile;
  let originalEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-integrations-'));
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

  it('seeds AH integration profile from the current production configuration', () => {
    ensureOrganizationIntegrations();
    const profile = getIntegrationProfile('user_ah');
    expect(profile.google.masterLeadSheetId).toBe('sheet_123');
    expect(profile.google.leadResponsesSheetId).toBe('sheet_123');
    expect(profile.gmail.senderEmail).toBe('ah@gshieldpest.com');
    expect(profile.twilio.phoneNumber).toBe('+15551234567');
    expect(profile.twilio.messagingServiceSid).toBe('MG1234567890');
  });

  it('creates, updates, and rejects duplicate profiles', () => {
    const user = createUser({
      organizationId: getDefaultOrganization().id,
      name: 'Jamie Taylor',
      displayName: 'Jamie T',
      email: 'jamie@example.com',
      initials: 'JT',
      role: 'sales_rep',
      status: 'active',
    }, 'user_ah');

    const created = createIntegrationProfile(user.id, {
      google: {
        masterLeadSheetId: 'sheet_jamie',
        leadResponsesSheetId: 'sheet_jamie_responses',
        customerDatabaseSheetId: '',
      },
      gmail: { senderEmail: 'jamie@example.com' },
      twilio: { phoneNumber: '(555) 123-4567', messagingServiceSid: '' },
      future: { fieldRoutes: null, notes: 'Initial profile' },
    }, 'user_ah');
    expect(created.userId).toBe(user.id);

    const updated = updateIntegrationProfile(user.id, {
      google: {
        masterLeadSheetId: 'sheet_jamie_2',
        leadResponsesSheetId: 'sheet_jamie_responses_2',
        customerDatabaseSheetId: 'sheet_customers',
      },
      gmail: { senderEmail: 'jamie.taylor@example.com' },
      twilio: { phoneNumber: '+15555550123', messagingServiceSid: 'MG1234567890' },
      future: { fieldRoutes: null, notes: 'Updated profile' },
    }, 'user_ah');

    expect(updated.google.masterLeadSheetId).toBe('sheet_jamie_2');
    expect(updated.gmail.senderEmail).toBe('jamie.taylor@example.com');
    expect(updated.twilio.phoneNumber).toBe('+15555550123');

    expect(() => createIntegrationProfile(user.id, {}, 'user_ah')).toThrow('Integration profile already exists for user');
  });

  it('rejects invalid profile data', () => {
    expect(() => updateIntegrationProfile('user_ah', {
      google: {
        masterLeadSheetId: 'sheet-1',
        leadResponsesSheetId: '',
        customerDatabaseSheetId: '',
      },
      gmail: { senderEmail: 'not-an-email' },
      twilio: { phoneNumber: 'abc', messagingServiceSid: 'short' },
      future: { fieldRoutes: {}, notes: null },
    }, 'user_ah')).toThrow('Google leadResponsesSheetId is required when Google Sheets is configured.');
  });

  it('lists profiles for the organization', () => {
    ensureOrganizationIntegrations();
    const profiles = listIntegrationProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(1);
  });
});
