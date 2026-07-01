import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getIntegrationHealth,
  resolveAllIntegrationConfigs,
  resolveFieldRoutesConfig,
  resolveGmailConfig,
  resolveGoogleSheetsConfig,
  resolveIntegrationProfile,
  resolveTwilioConfig,
} from '../integrationResolver.js';

describe('integrationResolver', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = {
      SHEET_ID: process.env.SHEET_ID,
      GMAIL_USER: process.env.GMAIL_USER,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
      TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
      TWILIO_MESSAGING_SERVICE_ID: process.env.TWILIO_MESSAGING_SERVICE_ID,
      FIELDROUTES_AUTH_STATE_JSON: process.env.FIELDROUTES_AUTH_STATE_JSON,
      FIELDROUTES_USERNAME: process.env.FIELDROUTES_USERNAME,
      FIELDROUTES_PASSWORD: process.env.FIELDROUTES_PASSWORD,
      FIELDROUTES_BASE_URL: process.env.FIELDROUTES_BASE_URL,
    };
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('resolves profile-only configs', () => {
    delete process.env.SHEET_ID;
    delete process.env.GMAIL_USER;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    delete process.env.TWILIO_MESSAGING_SERVICE_ID;
    delete process.env.FIELDROUTES_AUTH_STATE_JSON;
    delete process.env.FIELDROUTES_USERNAME;
    delete process.env.FIELDROUTES_PASSWORD;

    const context = {
      userId: 'user_ah',
      integrationProfile: {
        google: {
          masterLeadSheetId: 'profile-master',
          leadResponsesSheetId: 'profile-leads',
          customerDatabaseSheetId: 'profile-customers',
        },
        gmail: { senderEmail: 'profile@gshieldpest.com' },
        twilio: { phoneNumber: '+15551234567', messagingServiceSid: 'MG1234567890' },
        future: { fieldRoutes: { assigned: true }, notes: 'x' },
      },
    };

    expect(resolveIntegrationProfile(context)).toBe(context.integrationProfile);
    expect(resolveGoogleSheetsConfig(context)).toMatchObject({
      masterLeadSheetId: 'profile-master',
      leadResponsesSheetId: 'profile-leads',
      customerDatabaseSheetId: 'profile-customers',
      source: 'profile',
      configured: true,
    });
    expect(resolveGmailConfig(context)).toMatchObject({
      senderEmail: 'profile@gshieldpest.com',
      source: 'profile',
      configured: true,
    });
    expect(resolveTwilioConfig(context)).toMatchObject({
      phoneNumber: '+15551234567',
      messagingServiceSid: 'MG1234567890',
      source: 'profile',
      configured: true,
    });
    expect(resolveFieldRoutesConfig(context)).toMatchObject({
      source: 'profile',
      configured: true,
    });
  });

  it('falls back to env vars for AH-style production config', () => {
    process.env.SHEET_ID = 'env-sheet';
    process.env.GMAIL_USER = 'ah@gshieldpest.com';
    process.env.TWILIO_PHONE_NUMBER = '+15555550123';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG1234567890';
    process.env.FIELDROUTES_USERNAME = 'route-user';
    process.env.FIELDROUTES_PASSWORD = 'route-pass';

    const context = {
      userId: 'user_ah',
      integrationProfile: {
        google: {},
        gmail: {},
        twilio: {},
        future: { fieldRoutes: null, notes: null },
      },
    };

    expect(resolveGoogleSheetsConfig(context)).toMatchObject({
      masterLeadSheetId: 'env-sheet',
      leadResponsesSheetId: 'env-sheet',
      source: 'env',
      configured: true,
    });
    expect(resolveGmailConfig(context)).toMatchObject({
      senderEmail: 'ah@gshieldpest.com',
      source: 'env',
      configured: true,
    });
    expect(resolveTwilioConfig(context)).toMatchObject({
      phoneNumber: '+15555550123',
      messagingServiceSid: 'MG1234567890',
      source: 'env',
      configured: true,
    });
    expect(resolveFieldRoutesConfig(context)).toMatchObject({
      source: 'env',
      configured: true,
    });
  });

  it('reports mixed source when profile and env both contribute', () => {
    process.env.SHEET_ID = 'env-sheet';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG1234567890';
    const context = {
      userId: 'user_ah',
      integrationProfile: {
        google: {
          masterLeadSheetId: 'profile-master',
          leadResponsesSheetId: '',
          customerDatabaseSheetId: '',
        },
        gmail: { senderEmail: '' },
        twilio: { phoneNumber: '+15551234567', messagingServiceSid: '' },
        future: { fieldRoutes: null, notes: null },
      },
    };

    expect(resolveGoogleSheetsConfig(context)).toMatchObject({
      masterLeadSheetId: 'profile-master',
      leadResponsesSheetId: 'env-sheet',
      source: 'mixed',
      configured: true,
    });
    expect(resolveTwilioConfig(context)).toMatchObject({
      phoneNumber: '+15551234567',
      messagingServiceSid: 'MG1234567890',
      source: 'mixed',
      configured: true,
    });
  });

  it('reports missing fields in health summaries', () => {
    delete process.env.SHEET_ID;
    delete process.env.GMAIL_USER;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    delete process.env.TWILIO_MESSAGING_SERVICE_ID;
    delete process.env.FIELDROUTES_AUTH_STATE_JSON;
    delete process.env.FIELDROUTES_USERNAME;
    delete process.env.FIELDROUTES_PASSWORD;

    const context = {
      userId: 'user_ah',
      integrationProfile: {
        google: {},
        gmail: {},
        twilio: {},
        future: { fieldRoutes: null, notes: null },
      },
    };

    const health = getIntegrationHealth(context);
    expect(health.googleSheets.missing).toEqual(['masterLeadSheetId', 'leadResponsesSheetId']);
    expect(health.gmail.missing).toEqual(['senderEmail']);
    expect(health.twilio.missing).toEqual(['phoneNumber']);
    expect(health.fieldRoutes.missing).toEqual(
      expect.arrayContaining(['FIELDROUTES_AUTH_STATE_JSON', 'FIELDROUTES_USERNAME', 'FIELDROUTES_PASSWORD']),
    );
  });

  it('returns the combined config bundle', () => {
    process.env.SHEET_ID = 'env-sheet';
    const context = {
      userId: 'user_ah',
      integrationProfile: {
        google: {},
        gmail: {},
        twilio: {},
        future: { fieldRoutes: null, notes: null },
      },
    };

    const all = resolveAllIntegrationConfigs(context);
    expect(all.googleSheets.masterLeadSheetId).toBe('env-sheet');
    expect(all.gmail.configured).toBe(false);
    expect(all.twilio.configured).toBe(false);
  });
});
