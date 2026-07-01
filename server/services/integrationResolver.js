import { getIntegrationProfile } from './organizationIntegrations.js';

const FIELDROUTES_BASE_URL = 'https://greenshieldpestsolutions.fieldroutes.com';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasText(value) {
  return normalizeText(value) !== '';
}

function normalizePhoneNumber(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return `+${digits.slice(1).replace(/[^\d]/g, '')}`;
  return digits.replace(/[^\d]/g, '');
}

function hasProfile(context) {
  return Boolean(context?.integrationProfile && typeof context.integrationProfile === 'object');
}

function getProfile(context) {
  if (!context) return null;
  if (context.integrationProfile) return context.integrationProfile;
  if (!context.userId) return null;
  return getIntegrationProfile(context.userId);
}

function resolveSource(profileUsed, envUsed) {
  if (profileUsed && envUsed) return 'mixed';
  if (profileUsed) return 'profile';
  return 'env';
}

function resolveGoogleFromProfile(profile) {
  const google = profile?.google || {};
  return {
    masterLeadSheetId: hasText(google.masterLeadSheetId) ? normalizeText(google.masterLeadSheetId) : '',
    leadResponsesSheetId: hasText(google.leadResponsesSheetId) ? normalizeText(google.leadResponsesSheetId) : '',
    customerDatabaseSheetId: hasText(google.customerDatabaseSheetId) ? normalizeText(google.customerDatabaseSheetId) : '',
    profileUsed: hasText(google.masterLeadSheetId) || hasText(google.leadResponsesSheetId) || hasText(google.customerDatabaseSheetId),
  };
}

function resolveGoogleSheetsFromEnv() {
  const sheetId = normalizeText(process.env.SHEET_ID);
  const sheetName = normalizeText(process.env.SHEET_NAME) || 'Lead Responses';
  return {
    masterLeadSheetId: sheetId,
    leadResponsesSheetId: sheetId,
    customerDatabaseSheetId: '',
    sheetName,
    envUsed: hasText(sheetId),
  };
}

function resolveGmailFromEnv() {
  const senderEmail = normalizeText(process.env.GMAIL_USER).toLowerCase();
  return {
    senderEmail,
    envUsed: hasText(senderEmail),
  };
}

function resolveTwilioFromEnv() {
  const phoneNumber = normalizePhoneNumber(process.env.TWILIO_PHONE_NUMBER);
  const messagingServiceSid = normalizeText(
    process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_MESSAGING_SERVICE_ID,
  );
  return {
    phoneNumber,
    messagingServiceSid,
    envUsed: hasText(phoneNumber) || hasText(messagingServiceSid),
  };
}

function resolveFieldRoutesFromEnv() {
  const authStateJson = normalizeText(process.env.FIELDROUTES_AUTH_STATE_JSON);
  const username = normalizeText(process.env.FIELDROUTES_USERNAME);
  const password = normalizeText(process.env.FIELDROUTES_PASSWORD);
  const baseUrl = normalizeText(process.env.FIELDROUTES_BASE_URL) || FIELDROUTES_BASE_URL;
  return {
    authStateJson,
    username,
    password,
    baseUrl,
    envUsed: hasText(authStateJson) || (hasText(username) && hasText(password)),
  };
}

export function resolveIntegrationProfile(context) {
  return getProfile(context);
}

export function resolveGoogleSheetsConfig(context) {
  const profile = getProfile(context);
  const profileGoogle = resolveGoogleFromProfile(profile);
  const envGoogle = resolveGoogleSheetsFromEnv();
  const masterLeadSheetId = profileGoogle.masterLeadSheetId || envGoogle.masterLeadSheetId || '';
  const leadResponsesSheetId = profileGoogle.leadResponsesSheetId || envGoogle.leadResponsesSheetId || '';
  const customerDatabaseSheetId = profileGoogle.customerDatabaseSheetId || envGoogle.customerDatabaseSheetId || '';
  const sheetName = envGoogle.sheetName || 'Lead Responses';
  const profileUsed = profileGoogle.profileUsed && (
    (hasText(profileGoogle.masterLeadSheetId) && profileGoogle.masterLeadSheetId === masterLeadSheetId)
    || (hasText(profileGoogle.leadResponsesSheetId) && profileGoogle.leadResponsesSheetId === leadResponsesSheetId)
    || (hasText(profileGoogle.customerDatabaseSheetId) && profileGoogle.customerDatabaseSheetId === customerDatabaseSheetId)
  );
  const envUsed = envGoogle.envUsed && (
    (!hasText(profileGoogle.masterLeadSheetId) && hasText(envGoogle.masterLeadSheetId))
    || (!hasText(profileGoogle.leadResponsesSheetId) && hasText(envGoogle.leadResponsesSheetId))
  );

  return {
    masterLeadSheetId,
    leadResponsesSheetId,
    customerDatabaseSheetId,
    sheetName,
    source: resolveSource(profileUsed, envUsed),
    configured: Boolean(masterLeadSheetId && leadResponsesSheetId),
  };
}

export function resolveGmailConfig(context) {
  const profile = getProfile(context);
  const profileEmail = normalizeText(profile?.gmail?.senderEmail).toLowerCase();
  const envGmail = resolveGmailFromEnv();
  const senderEmail = profileEmail || envGmail.senderEmail || '';
  const profileUsed = hasText(profileEmail);
  const envUsed = !profileUsed && envGmail.envUsed;
  return {
    senderEmail,
    source: resolveSource(profileUsed, envUsed),
    configured: Boolean(senderEmail),
  };
}

export function resolveTwilioConfig(context) {
  const profile = getProfile(context);
  const profileTwilio = profile?.twilio || {};
  const envTwilio = resolveTwilioFromEnv();
  const phoneNumber = normalizePhoneNumber(profileTwilio.phoneNumber) || envTwilio.phoneNumber || '';
  const messagingServiceSid = normalizeText(profileTwilio.messagingServiceSid) || envTwilio.messagingServiceSid || '';
  const profileUsed = hasText(profileTwilio.phoneNumber) || hasText(profileTwilio.messagingServiceSid);
  const envUsed = envTwilio.envUsed && (
    (!hasText(profileTwilio.phoneNumber) && hasText(envTwilio.phoneNumber))
    || (!hasText(profileTwilio.messagingServiceSid) && hasText(envTwilio.messagingServiceSid))
  );
  return {
    phoneNumber,
    messagingServiceSid,
    source: resolveSource(profileUsed, envUsed),
    configured: Boolean(phoneNumber || messagingServiceSid),
  };
}

export function resolveFieldRoutesConfig(context) {
  const profile = getProfile(context);
  const profileFieldRoutes = profile?.future?.fieldRoutes && typeof profile.future.fieldRoutes === 'object'
    ? profile.future.fieldRoutes
    : null;
  const envFieldRoutes = resolveFieldRoutesFromEnv();
  const configured = Boolean(profileFieldRoutes || envFieldRoutes.envUsed);
  const profileUsed = Boolean(profileFieldRoutes);
  const envUsed = !profileUsed && envFieldRoutes.envUsed;
  return {
    source: resolveSource(profileUsed, envUsed),
    configured,
  };
}

export function resolveAllIntegrationConfigs(context) {
  return {
    integrationProfile: resolveIntegrationProfile(context),
    googleSheets: resolveGoogleSheetsConfig(context),
    gmail: resolveGmailConfig(context),
    twilio: resolveTwilioConfig(context),
    fieldRoutes: resolveFieldRoutesConfig(context),
  };
}

export function getIntegrationHealth(context) {
  const googleSheets = resolveGoogleSheetsConfig(context);
  const gmail = resolveGmailConfig(context);
  const twilio = resolveTwilioConfig(context);
  const fieldRoutes = resolveFieldRoutesConfig(context);

  return {
    googleSheets: {
      configured: googleSheets.configured,
      source: googleSheets.source,
      missing: [
        ...(!googleSheets.masterLeadSheetId ? ['masterLeadSheetId'] : []),
        ...(!googleSheets.leadResponsesSheetId ? ['leadResponsesSheetId'] : []),
      ],
    },
    gmail: {
      configured: gmail.configured,
      source: gmail.source,
      missing: [
        ...(!gmail.senderEmail ? ['senderEmail'] : []),
      ],
    },
    twilio: {
      configured: twilio.configured,
      source: twilio.source,
      missing: [
        ...(!twilio.phoneNumber ? ['phoneNumber'] : []),
      ],
    },
    fieldRoutes: {
      configured: fieldRoutes.configured,
      source: fieldRoutes.source,
      missing: fieldRoutes.configured
        ? []
        : [
            ...(!hasText(process.env.FIELDROUTES_AUTH_STATE_JSON) ? ['FIELDROUTES_AUTH_STATE_JSON'] : []),
            ...(!hasText(process.env.FIELDROUTES_USERNAME) ? ['FIELDROUTES_USERNAME'] : []),
            ...(!hasText(process.env.FIELDROUTES_PASSWORD) ? ['FIELDROUTES_PASSWORD'] : []),
          ],
    },
  };
}
