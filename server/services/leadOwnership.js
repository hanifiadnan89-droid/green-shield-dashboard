import {
  getDefaultOrganization,
  getUserById,
} from './organizationUsers.js';
import {
  getLeadOwnershipStore,
} from './leadOwnershipStore.js';
export { getLeadOwnershipFilePath } from './leadOwnershipStore.js';

const DEFAULT_ORG_ID = 'org_green_shield';
const DEFAULT_OWNER_USER_ID = 'user_ah';
const DEFAULT_CREATED_BY = 'system';

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRowNumber(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function readStore() {
  return getLeadOwnershipStore().read();
}

function sanitizeOwnership(record, fallbackSource = 'default') {
  if (!record) return null;
  return {
    rowNumber: record.rowNumber,
    organizationId: record.organizationId || DEFAULT_ORG_ID,
    ownerUserId: record.ownerUserId || DEFAULT_OWNER_USER_ID,
    createdBy: record.createdBy || DEFAULT_CREATED_BY,
    updatedBy: record.updatedBy || DEFAULT_CREATED_BY,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    source: record.source || fallbackSource,
  };
}

function resolveRowNumber(input) {
  if (input && typeof input === 'object') {
    return normalizeRowNumber(
      input.rowNumber
      ?? input.row_number
      ?? input.row
      ?? input.id,
    );
  }
  return normalizeRowNumber(input);
}

function resolveOrganizationId(input, context) {
  return normalizeText(input?.organizationId)
    || normalizeText(context?.organizationId)
    || getDefaultOrganization()?.id
    || DEFAULT_ORG_ID;
}

function resolveOwnerUserId(input, context, fallback = DEFAULT_OWNER_USER_ID) {
  return normalizeText(input?.ownerUserId)
    || normalizeText(context?.userId)
    || fallback;
}

function normalizeStoredOwnership(rowNumber, record) {
  if (!rowNumber || !record || typeof record !== 'object') return null;
  const organizationId = normalizeText(record?.organizationId) || DEFAULT_ORG_ID;
  const ownerUserId = normalizeText(record?.ownerUserId) || DEFAULT_OWNER_USER_ID;
  return sanitizeOwnership({
    rowNumber,
    organizationId,
    ownerUserId,
    createdBy: normalizeText(record?.createdBy) || DEFAULT_CREATED_BY,
    updatedBy: normalizeText(record?.updatedBy) || DEFAULT_CREATED_BY,
    createdAt: record?.createdAt || null,
    updatedAt: record?.updatedAt || null,
    source: record?.source || 'store',
  }, 'store');
}

function getStoredOwnership(store, rowNumber) {
  const key = resolveRowNumber(rowNumber);
  if (!key) return null;
  return normalizeStoredOwnership(key, store.leads[key]);
}

function defaultOwnership(rowNumber) {
  const key = resolveRowNumber(rowNumber);
  if (!key) return null;
  return sanitizeOwnership({
    rowNumber: key,
    organizationId: DEFAULT_ORG_ID,
    ownerUserId: DEFAULT_OWNER_USER_ID,
    createdBy: DEFAULT_CREATED_BY,
    updatedBy: DEFAULT_CREATED_BY,
    createdAt: null,
    updatedAt: null,
    source: 'default',
  }, 'default');
}

function assertValidUserInOrg(organizationId, userId) {
  const org = getDefaultOrganization()?.id === organizationId ? getDefaultOrganization() : null;
  const user = getUserById(userId);
  if (!org) {
    const err = new Error(`Organization not found: ${organizationId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!user || user.organizationId !== organizationId) {
    const err = new Error(`User not found in organization: ${userId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return user;
}

export function validateLeadOwnership(ownership) {
  const normalizedRowNumber = resolveRowNumber(ownership);
  const organizationId = resolveOrganizationId(ownership);
  const ownerUserId = resolveOwnerUserId(ownership, null, DEFAULT_OWNER_USER_ID);
  const errors = [];

  if (!normalizedRowNumber) {
    errors.push('Lead row number is required.');
  }
  if (!organizationId) {
    errors.push('organizationId is required.');
  }
  if (!ownerUserId) {
    errors.push('ownerUserId is required.');
  }

  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const organization = getDefaultOrganization();
  if (!organization || organization.id !== organizationId) {
    const err = new Error(`Organization not found: ${organizationId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }

  const user = getUserById(ownerUserId);
  if (!user || user.organizationId !== organizationId) {
    const err = new Error(`User not found in organization: ${ownerUserId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }

  return sanitizeOwnership({
    rowNumber: normalizedRowNumber,
    organizationId,
    ownerUserId,
    createdBy: normalizeText(ownership?.createdBy) || DEFAULT_CREATED_BY,
    updatedBy: normalizeText(ownership?.updatedBy) || DEFAULT_CREATED_BY,
    createdAt: ownership?.createdAt || null,
    updatedAt: ownership?.updatedAt || null,
    source: ownership?.source || 'store',
  }, ownership?.source || 'store');
}

function setOwnershipRecord(rowNumber, record) {
  const key = resolveRowNumber(rowNumber);
  if (!key) return null;
  return getLeadOwnershipStore().upsert({
    rowNumber: key,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    source: record.source || 'store',
  });
}

export function resolveLeadOwner(leadOrRowNumber, context = null) {
  const rowNumber = resolveRowNumber(leadOrRowNumber);
  if (!rowNumber) return null;
  const store = readStore();
  const explicitLead = leadOrRowNumber && typeof leadOrRowNumber === 'object' ? leadOrRowNumber : null;
  const directRecord = explicitLead?.ownerUserId && explicitLead?.organizationId
    ? normalizeStoredOwnership(rowNumber, explicitLead)
    : null;
  if (directRecord) return directRecord;
  const stored = getStoredOwnership(store, rowNumber);
  if (stored) return stored;
  return defaultOwnership(rowNumber, context);
}

export function getLeadOwner(leadOrRowNumber, context = null) {
  return resolveLeadOwner(leadOrRowNumber, context);
}

export function isLeadOwnedByUser(context, leadOrRowNumber) {
  const owner = resolveLeadOwner(leadOrRowNumber, context);
  if (!context || !owner) return false;
  return normalizeText(context.userId) === normalizeText(owner.ownerUserId)
    && normalizeText(context.organizationId) === normalizeText(owner.organizationId);
}

export function canViewLead(context, leadOrRowNumber) {
  return isLeadOwnedByUser(context, leadOrRowNumber);
}

export function canEditLead(context, leadOrRowNumber) {
  return isLeadOwnedByUser(context, leadOrRowNumber);
}

export function assignLeadOwner(leadOrRowNumber, context = null, overrides = {}) {
  const rowNumber = resolveRowNumber(leadOrRowNumber);
  if (!rowNumber) {
    const err = new Error('Lead row number is required.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const store = readStore();
  const existing = getStoredOwnership(store, rowNumber);
  const now = nowIso();
  const organizationId = resolveOrganizationId(overrides, context);
  const ownerUserId = resolveOwnerUserId(overrides, context, existing?.ownerUserId || DEFAULT_OWNER_USER_ID);
  const createdBy = normalizeText(overrides.createdBy)
    || existing?.createdBy
    || normalizeText(context?.userId)
    || DEFAULT_CREATED_BY;
  const updatedBy = normalizeText(overrides.updatedBy)
    || normalizeText(context?.userId)
    || createdBy
    || DEFAULT_CREATED_BY;
  const createdAt = overrides.createdAt || existing?.createdAt || now;
  const updatedAt = overrides.updatedAt || now;
  const next = validateLeadOwnership({
    rowNumber,
    organizationId,
    ownerUserId,
    createdBy,
    updatedBy,
    createdAt,
    updatedAt,
    source: existing ? 'store' : 'store',
  });

  setOwnershipRecord(rowNumber, next);
  return next;
}

export function transferLeadOwnership(leadOrRowNumber, nextOwnerUserId, context = null) {
  const rowNumber = resolveRowNumber(leadOrRowNumber);
  if (!rowNumber) {
    const err = new Error('Lead row number is required.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const current = resolveLeadOwner(rowNumber);
  const organizationId = current?.organizationId || resolveOrganizationId(null, context);
  const targetOwnerId = normalizeText(nextOwnerUserId);
  if (!targetOwnerId) {
    const err = new Error('ownerUserId is required.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  assertValidUserInOrg(organizationId, targetOwnerId);

  const now = nowIso();
  const next = validateLeadOwnership({
    rowNumber,
    organizationId,
    ownerUserId: targetOwnerId,
    createdBy: current?.createdBy || DEFAULT_CREATED_BY,
    updatedBy: normalizeText(context?.userId) || DEFAULT_CREATED_BY,
    createdAt: current?.createdAt || now,
    updatedAt: now,
    source: 'store',
  });

  setOwnershipRecord(rowNumber, next);
  return next;
}

export function decorateLeadOwnership(lead, context = null) {
  if (!lead || typeof lead !== 'object') return lead;
  const ownership = resolveLeadOwner(lead, context);
  if (!ownership) return { ...lead };
  return {
    ...lead,
    organizationId: ownership.organizationId,
    ownerUserId: ownership.ownerUserId,
    createdBy: ownership.createdBy,
    updatedBy: ownership.updatedBy,
    createdAt: ownership.createdAt,
    updatedAt: ownership.updatedAt,
  };
}

export function updateLeadOwnershipMetadata(rowNumber, context = null) {
  const store = readStore();
  const existing = getStoredOwnership(store, rowNumber) || resolveLeadOwner(rowNumber);
  const next = validateLeadOwnership({
    rowNumber: resolveRowNumber(rowNumber),
    organizationId: existing?.organizationId || resolveOrganizationId(null, context),
    ownerUserId: existing?.ownerUserId || DEFAULT_OWNER_USER_ID,
    createdBy: existing?.createdBy || DEFAULT_CREATED_BY,
    updatedBy: normalizeText(context?.userId) || DEFAULT_CREATED_BY,
    createdAt: existing?.createdAt || null,
    updatedAt: nowIso(),
    source: existing?.source === 'default' ? 'store' : (existing?.source || 'store'),
  });

  setOwnershipRecord(rowNumber, next);
  return next;
}

export function listLeadOwnershipRecords() {
  const store = readStore();
  return Object.values(store.leads)
    .map((record) => normalizeStoredOwnership(record.rowNumber, record))
    .filter(Boolean);
}

export { DEFAULT_ORG_ID, DEFAULT_OWNER_USER_ID, DEFAULT_CREATED_BY };
