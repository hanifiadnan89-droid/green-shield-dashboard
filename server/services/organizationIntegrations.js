import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_ORG_ID, getUserRecordById } from './organizationUsers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DEFAULT_INTEGRATIONS_FILE = path.join(DATA_DIR, 'organization-integrations.json');
const DEFAULT_AH_USER_ID = 'user_ah';

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePhoneNumber(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return `+${digits.slice(1).replace(/[^\d]/g, '')}`;
  return digits.replace(/[^\d]/g, '');
}

function atomicWriteJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function getIntegrationsFilePath() {
  return normalizeText(process.env.ORGANIZATION_INTEGRATIONS_FILE) || DEFAULT_INTEGRATIONS_FILE;
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn('[organizationIntegrations] Failed to read integration profile store:', err.message);
    return fallback;
  }
}

function sanitizeProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    google: { ...(profile.google || {}) },
    gmail: { ...(profile.gmail || {}) },
    twilio: { ...(profile.twilio || {}) },
    future: { ...(profile.future || {}) },
  };
}

function buildSeedProfileFromEnv(userId) {
  const createdAt = nowIso();
  const sheetId = normalizeText(process.env.SHEET_ID);
  const senderEmail = normalizeEmail(process.env.GMAIL_USER);
  const phoneNumber = normalizePhoneNumber(process.env.TWILIO_PHONE_NUMBER);
  const messagingServiceSid = normalizeText(
    process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_MESSAGING_SERVICE_ID,
  );

  return {
    id: `integration_${DEFAULT_AH_USER_ID}`,
    organizationId: DEFAULT_ORG_ID,
    userId,
    google: {
      masterLeadSheetId: sheetId || null,
      leadResponsesSheetId: sheetId || null,
      customerDatabaseSheetId: null,
    },
    gmail: {
      senderEmail: senderEmail || null,
    },
    twilio: {
      phoneNumber: phoneNumber || null,
      messagingServiceSid: messagingServiceSid || null,
    },
    future: {
      fieldRoutes: null,
      notes: 'Seeded from current production configuration.',
    },
    createdAt,
    updatedAt: createdAt,
  };
}

function buildBlankProfile(userId, organizationId = DEFAULT_ORG_ID) {
  const createdAt = nowIso();
  return {
    id: `integration_${userId}`,
    organizationId,
    userId,
    google: {
      masterLeadSheetId: null,
      leadResponsesSheetId: null,
      customerDatabaseSheetId: null,
    },
    gmail: {
      senderEmail: null,
    },
    twilio: {
      phoneNumber: null,
      messagingServiceSid: null,
    },
    future: {
      fieldRoutes: null,
      notes: null,
    },
    createdAt,
    updatedAt: createdAt,
  };
}

function normalizeStoredProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const blank = buildBlankProfile(profile.userId || DEFAULT_AH_USER_ID, profile.organizationId || DEFAULT_ORG_ID);
  return {
    ...blank,
    ...profile,
    organizationId: normalizeText(profile.organizationId) || DEFAULT_ORG_ID,
    userId: normalizeText(profile.userId) || DEFAULT_AH_USER_ID,
    google: {
      masterLeadSheetId: normalizeText(profile.google?.masterLeadSheetId) || null,
      leadResponsesSheetId: normalizeText(profile.google?.leadResponsesSheetId) || null,
      customerDatabaseSheetId: normalizeText(profile.google?.customerDatabaseSheetId) || null,
    },
    gmail: {
      senderEmail: normalizeEmail(profile.gmail?.senderEmail) || null,
    },
    twilio: {
      phoneNumber: normalizePhoneNumber(profile.twilio?.phoneNumber) || null,
      messagingServiceSid: normalizeText(profile.twilio?.messagingServiceSid) || null,
    },
    future: {
      fieldRoutes: profile.future?.fieldRoutes ?? null,
      notes: normalizeText(profile.future?.notes) || null,
    },
  };
}

function ensureSeededStore(store) {
  const now = nowIso();
  const profiles = Array.isArray(store?.profiles) ? store.profiles.map(normalizeStoredProfile).filter(Boolean) : [];
  const next = { profiles };

  if (!next.profiles.some((profile) => profile.userId === DEFAULT_AH_USER_ID)) {
    next.profiles.push(buildSeedProfileFromEnv(DEFAULT_AH_USER_ID));
  }

  for (const profile of next.profiles) {
    profile.organizationId = profile.organizationId || DEFAULT_ORG_ID;
    profile.userId = profile.userId || DEFAULT_AH_USER_ID;
    profile.updatedAt = profile.updatedAt || now;
    profile.createdAt = profile.createdAt || profile.updatedAt || now;
  }

  return next;
}

function readStore() {
  const raw = readJsonFile(getIntegrationsFilePath(), null);
  if (!raw || typeof raw !== 'object') {
    return ensureSeededStore({ profiles: [] });
  }
  return ensureSeededStore(raw);
}

function writeStore(store) {
  atomicWriteJsonFile(getIntegrationsFilePath(), store);
}

function persist(mutator) {
  const store = readStore();
  const next = mutator(store) || store;
  writeStore(next);
  return next;
}

function assertValidUser(userId) {
  const user = getUserRecordById(userId);
  if (!user) {
    const err = new Error(`User not found: ${userId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return user;
}

function normalizeProfileInput(input = {}) {
  return {
    google: {
      masterLeadSheetId: normalizeText(input.google?.masterLeadSheetId) || null,
      leadResponsesSheetId: normalizeText(input.google?.leadResponsesSheetId) || null,
      customerDatabaseSheetId: normalizeText(input.google?.customerDatabaseSheetId) || null,
    },
    gmail: {
      senderEmail: normalizeEmail(input.gmail?.senderEmail) || null,
    },
    twilio: {
      phoneNumber: normalizePhoneNumber(input.twilio?.phoneNumber) || null,
      messagingServiceSid: normalizeText(input.twilio?.messagingServiceSid) || null,
    },
    future: {
      fieldRoutes: input.future?.fieldRoutes ?? null,
      notes: normalizeText(input.future?.notes) || null,
    },
  };
}

function normalizeProfileUpdate(input = {}) {
  const patch = {};
  if (input.google) {
    patch.google = {};
    if ('masterLeadSheetId' in input.google) {
      patch.google.masterLeadSheetId = normalizeText(input.google.masterLeadSheetId) || null;
    }
    if ('leadResponsesSheetId' in input.google) {
      patch.google.leadResponsesSheetId = normalizeText(input.google.leadResponsesSheetId) || null;
    }
    if ('customerDatabaseSheetId' in input.google) {
      patch.google.customerDatabaseSheetId = normalizeText(input.google.customerDatabaseSheetId) || null;
    }
  }
  if (input.gmail) {
    patch.gmail = {};
    if ('senderEmail' in input.gmail) {
      patch.gmail.senderEmail = normalizeEmail(input.gmail.senderEmail) || null;
    }
  }
  if (input.twilio) {
    patch.twilio = {};
    if ('phoneNumber' in input.twilio) {
      patch.twilio.phoneNumber = normalizePhoneNumber(input.twilio.phoneNumber) || null;
    }
    if ('messagingServiceSid' in input.twilio) {
      patch.twilio.messagingServiceSid = normalizeText(input.twilio.messagingServiceSid) || null;
    }
  }
  if (input.future) {
    patch.future = {};
    if ('fieldRoutes' in input.future) {
      patch.future.fieldRoutes = input.future.fieldRoutes ?? null;
    }
    if ('notes' in input.future) {
      patch.future.notes = normalizeText(input.future.notes) || null;
    }
  }
  return patch;
}

export function validateIntegrationProfile(profile) {
  const normalized = normalizeStoredProfile(profile);
  const errors = [];

  if (!normalized) {
    const err = new Error('Integration profile is required.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!normalized.userId) errors.push('userId is required.');
  if (!normalized.organizationId) errors.push('organizationId is required.');

  const hasAnyGoogleField = Boolean(
    normalized.google.masterLeadSheetId
    || normalized.google.leadResponsesSheetId
    || normalized.google.customerDatabaseSheetId,
  );
  if (hasAnyGoogleField) {
    if (!normalized.google.masterLeadSheetId) errors.push('Google masterLeadSheetId is required when Google Sheets is configured.');
    if (!normalized.google.leadResponsesSheetId) errors.push('Google leadResponsesSheetId is required when Google Sheets is configured.');
  }

  if (normalized.gmail.senderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.gmail.senderEmail)) {
    errors.push('gmail.senderEmail must be a valid email address.');
  }

  if (normalized.twilio.phoneNumber && !/^\+?[0-9]{7,15}$/.test(normalized.twilio.phoneNumber)) {
    errors.push('twilio.phoneNumber must be a normalized phone number.');
  }

  if (normalized.twilio.messagingServiceSid && !/^[a-zA-Z0-9_-]{10,64}$/.test(normalized.twilio.messagingServiceSid)) {
    errors.push('twilio.messagingServiceSid is invalid.');
  }

  if (normalized.future.fieldRoutes !== null && typeof normalized.future.fieldRoutes !== 'object') {
    errors.push('future.fieldRoutes must be null or an object.');
  }

  if (normalized.future.notes !== null && typeof normalized.future.notes !== 'string') {
    errors.push('future.notes must be null or a string.');
  }

  if (errors.length > 0) {
    const err = new Error(errors.join(' '));
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  return normalized;
}

export function ensureOrganizationIntegrations() {
  const store = readStore();
  writeStore(store);
  return store;
}

export function listIntegrationProfiles({ organizationId = DEFAULT_ORG_ID } = {}) {
  const store = readStore();
  return store.profiles
    .filter((profile) => profile.organizationId === organizationId)
    .map(sanitizeProfile);
}

export function getIntegrationProfile(userId) {
  const store = readStore();
  const existing = store.profiles.find((profile) => profile.userId === userId);
  if (existing) return sanitizeProfile(existing);
  const user = assertValidUser(userId);
  const created = createIntegrationProfile(userId, buildBlankProfile(userId, user.organizationId));
  return created;
}

export function createIntegrationProfile(userId, input = {}, actorUserId = 'system') {
  const user = assertValidUser(userId);
  const store = readStore();
  const existing = store.profiles.find((profile) => profile.userId === userId);
  if (existing) {
    const err = new Error(`Integration profile already exists for user: ${userId}`);
    err.code = 'DUPLICATE_PROFILE';
    throw err;
  }

  const now = nowIso();
  const normalized = validateIntegrationProfile({
    ...buildBlankProfile(userId, user.organizationId),
    ...normalizeProfileInput(input),
    organizationId: user.organizationId,
    userId,
  });
  const profile = {
    ...normalized,
    id: `integration_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
    createdBy: normalizeText(actorUserId) || 'system',
    updatedBy: normalizeText(actorUserId) || 'system',
  };

  persist((current) => {
    current.profiles.unshift(profile);
    return current;
  });

  return sanitizeProfile(profile);
}

export function updateIntegrationProfile(userId, updates = {}, actorUserId = 'system') {
  const store = readStore();
  const existing = store.profiles.find((profile) => profile.userId === userId);
  if (!existing) {
    return createIntegrationProfile(userId, updates, actorUserId);
  }

  const user = assertValidUser(userId);
  const patch = normalizeProfileUpdate(updates);
  const nextProfile = validateIntegrationProfile({
    ...existing,
    ...patch,
    google: {
      ...existing.google,
      ...(patch.google || {}),
    },
    gmail: {
      ...existing.gmail,
      ...(patch.gmail || {}),
    },
    twilio: {
      ...existing.twilio,
      ...(patch.twilio || {}),
    },
    future: {
      ...existing.future,
      ...(patch.future || {}),
    },
    organizationId: existing.organizationId || user.organizationId,
    userId,
  });
  const profile = {
    ...existing,
    ...nextProfile,
    updatedAt: nowIso(),
    updatedBy: normalizeText(actorUserId) || 'system',
  };

  persist((current) => {
    const idx = current.profiles.findIndex((item) => item.userId === userId);
    if (idx === -1) {
      current.profiles.unshift(profile);
    } else {
      current.profiles[idx] = profile;
    }
    return current;
  });

  return sanitizeProfile(profile);
}

export function getIntegrationProfileRecord(userId) {
  const store = readStore();
  return store.profiles.find((profile) => profile.userId === userId) || null;
}

export function getIntegrationProfileByUserId(userId) {
  return getIntegrationProfile(userId);
}

export function getOrganizationIntegrationsSnapshot() {
  const store = readStore();
  return {
    profiles: store.profiles.map(sanitizeProfile),
  };
}

export { DEFAULT_INTEGRATIONS_FILE, getIntegrationsFilePath };
