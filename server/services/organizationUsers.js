import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DEFAULT_TENANCY_FILE = path.join(DATA_DIR, 'internal-tenancy.json');

const DEFAULT_ORG_ID = 'org_green_shield';
const DEFAULT_ORG_SLUG = 'green-shield';
const DEFAULT_ORG_NAME = 'Green Shield Pest Solutions';
const DEFAULT_ADMIN_ID = 'user_ah';
const ROLE_CAPABILITIES = {
  admin: [
    'manage_users',
    'view_users',
    'create_users',
    'update_users',
    'deactivate_users',
    'reactivate_users',
  ],
  manager: ['view_users'],
  sales_rep: [],
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toUpperInitials(value) {
  return normalizeText(value).toUpperCase();
}

function atomicWriteJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

export function getTenancyFilePath() {
  return normalizeText(process.env.INTERNAL_TENANCY_FILE) || DEFAULT_TENANCY_FILE;
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn('[organizationUsers] Failed to read organization user store:', err.message);
    return fallback;
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  const { authUsername, ...rest } = user;
  return rest;
}

function sanitizeOrganization(org) {
  if (!org) return null;
  return { ...org };
}

function normalizeStoredUser(user, now = nowIso()) {
  if (!user || typeof user !== 'object') return null;
  const name = normalizeText(user.name);
  return {
    ...user,
    organizationId: normalizeText(user.organizationId) || DEFAULT_ORG_ID,
    name,
    displayName: normalizeText(user.displayName) || name,
    email: normalizeText(user.email).toLowerCase(),
    initials: toUpperInitials(user.initials),
    role: normalizeText(user.role) || 'sales_rep',
    status: ['active', 'inactive'].includes(normalizeText(user.status)) ? normalizeText(user.status) : 'active',
    createdBy: normalizeText(user.createdBy) || 'system',
    updatedBy: normalizeText(user.updatedBy) || 'system',
    createdAt: user.createdAt || now,
    updatedAt: user.updatedAt || now,
  };
}

function createSeedState() {
  const authUsername = normalizeText(process.env.DASHBOARD_USERNAME) || 'ah';
  const email = normalizeText(process.env.DASHBOARD_USERNAME)?.includes('@')
    ? normalizeText(process.env.DASHBOARD_USERNAME)
    : 'ah@gshieldpest.com';
  const createdAt = nowIso();

  return {
    organizations: [{
      id: DEFAULT_ORG_ID,
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG,
      createdAt,
      updatedAt: createdAt,
    }],
    users: [{
      id: DEFAULT_ADMIN_ID,
      organizationId: DEFAULT_ORG_ID,
      name: 'Adnan / AH',
      displayName: 'Adnan / AH',
      email,
      initials: 'AH',
      role: 'admin',
      status: 'active',
      createdBy: 'system',
      updatedBy: 'system',
      authUsername,
      createdAt,
      updatedAt: createdAt,
    }],
  };
}

function ensureSeededStore(store) {
  const now = nowIso();
  const next = {
    organizations: Array.isArray(store?.organizations) ? [...store.organizations] : [],
    users: Array.isArray(store?.users) ? [...store.users] : [],
  };

  if (!next.organizations.some((org) => org.id === DEFAULT_ORG_ID)) {
    next.organizations.unshift(createSeedState().organizations[0]);
  }

  const org = next.organizations.find((item) => item.id === DEFAULT_ORG_ID);
  if (org) {
    org.name = org.name || DEFAULT_ORG_NAME;
    org.slug = org.slug || DEFAULT_ORG_SLUG;
    org.createdAt = org.createdAt || now;
    org.updatedAt = org.updatedAt || now;
  }

  const authUsername = normalizeText(process.env.DASHBOARD_USERNAME) || 'ah';
  const adminIdx = next.users.findIndex((user) => user.id === DEFAULT_ADMIN_ID || toUpperInitials(user.initials) === 'AH');
  if (adminIdx === -1) {
    next.users.unshift(createSeedState().users[0]);
  } else {
    const existing = normalizeStoredUser(next.users[adminIdx], now);
    next.users[adminIdx] = {
      ...existing,
      organizationId: existing.organizationId || DEFAULT_ORG_ID,
      name: existing.name || 'Adnan / AH',
      displayName: existing.displayName || existing.name || 'Adnan / AH',
      email: existing.email || (authUsername.includes('@') ? authUsername : 'ah@gshieldpest.com'),
      initials: toUpperInitials(existing.initials) || 'AH',
      role: existing.role || 'admin',
      status: existing.status || 'active',
      createdBy: existing.createdBy || 'system',
      updatedBy: existing.updatedBy || 'system',
      authUsername,
      createdAt: existing.createdAt || now,
      updatedAt: existing.updatedAt || now,
    };
  }

  next.users = next.users.map((user) => normalizeStoredUser(user, now)).filter(Boolean);
  return next;
}

function readStore() {
  const raw = readJsonFile(getTenancyFilePath(), null);
  if (!raw || typeof raw !== 'object') {
    return ensureSeededStore(createSeedState());
  }
  return ensureSeededStore(raw);
}

function writeStore(store) {
  atomicWriteJsonFile(getTenancyFilePath(), store);
}

function persist(mutator) {
  const store = readStore();
  const next = mutator(store) || store;
  writeStore(next);
  return next;
}

function requireActiveOrganization(store, organizationId) {
  const org = store.organizations.find((item) => item.id === organizationId);
  if (!org) {
    const err = new Error(`Organization not found: ${organizationId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return org;
}

function requireActiveUserRecord(store, userId, organizationId = null) {
  const user = store.users.find((item) => item.id === userId);
  if (!user) {
    const err = new Error(`User not found: ${userId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (organizationId && user.organizationId !== organizationId) {
    const err = new Error(`User not found: ${userId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return user;
}

function normalizeUserInput(input = {}) {
  return {
    name: normalizeText(input.name),
    displayName: normalizeText(input.displayName),
    email: normalizeText(input.email).toLowerCase(),
    initials: toUpperInitials(input.initials),
    role: normalizeText(input.role),
    status: normalizeText(input.status) || 'active',
  };
}

function assertUserInput(store, input, { userId = null } = {}) {
  const normalized = normalizeUserInput(input);
  const errors = [];

  if (!normalized.name) errors.push('Name is required.');
  if (!normalized.email) errors.push('Email is required.');
  if (!normalized.initials) errors.push('Initials are required.');
  if (!['admin', 'manager', 'sales_rep'].includes(normalized.role)) {
    errors.push('Role must be admin, manager, or sales_rep.');
  }
  if (!['active', 'inactive'].includes(normalized.status)) {
    errors.push('Status must be active or inactive.');
  }

  const orgId = normalizeText(input.organizationId) || DEFAULT_ORG_ID;
  requireActiveOrganization(store, orgId);

  const emailConflict = store.users.find((user) =>
    user.organizationId === orgId
    && normalizeText(user.email).toLowerCase() === normalized.email
    && user.id !== userId,
  );
  if (emailConflict) errors.push('Email must be unique within the organization.');

  const initialsConflict = store.users.find((user) =>
    user.organizationId === orgId
    && toUpperInitials(user.initials) === normalized.initials
    && user.id !== userId,
  );
  if (initialsConflict) errors.push('Initials must be unique within the organization.');

  if (errors.length > 0) {
    const err = new Error(errors.join(' '));
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  return {
    ...normalized,
    displayName: normalized.displayName || normalized.name,
    organizationId: orgId,
  };
}

function getActiveAdminCount(store, organizationId) {
  return store.users.filter((user) =>
    user.organizationId === organizationId
    && user.role === 'admin'
    && user.status === 'active',
  ).length;
}

function assertAtLeastOneActiveAdminRemaining(store, userId, nextRole, nextStatus) {
  const existing = requireActiveUserRecord(store, userId);
  const currentActiveAdmins = getActiveAdminCount(store, existing.organizationId);
  const wasActiveAdmin = existing.role === 'admin' && existing.status === 'active';
  const willBeActiveAdmin = (nextRole || existing.role) === 'admin' && (nextStatus || existing.status) === 'active';
  const projectedActiveAdmins = currentActiveAdmins - (wasActiveAdmin ? 1 : 0) + (willBeActiveAdmin ? 1 : 0);

  if (projectedActiveAdmins < 1) {
    const err = new Error('At least one active admin must remain in the organization.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
}

function normalizeAuditActor(actorUserId) {
  return normalizeText(actorUserId) || 'system';
}

export function ensureInternalTenancy() {
  const store = readStore();
  writeStore(store);
  return store;
}

export function getInternalTenancySnapshot() {
  const store = readStore();
  return {
    organizations: store.organizations.map(sanitizeOrganization),
    users: store.users.map(sanitizeUser),
  };
}

export function listOrganizations() {
  return readStore().organizations.map(sanitizeOrganization);
}

export function getOrganizationById(id) {
  const store = readStore();
  return sanitizeOrganization(store.organizations.find((item) => item.id === id) || null);
}

export function getDefaultOrganization() {
  return getOrganizationById(DEFAULT_ORG_ID);
}

export function listUsers({ organizationId = DEFAULT_ORG_ID, includeInactive = true } = {}) {
  const store = readStore();
  return store.users
    .filter((user) => user.organizationId === organizationId)
    .filter((user) => includeInactive || user.status === 'active')
    .map(sanitizeUser);
}

export function getUserById(id) {
  const store = readStore();
  return sanitizeUser(store.users.find((item) => item.id === id) || null);
}

export function getUserRecordById(id) {
  const store = readStore();
  return store.users.find((item) => item.id === id) || null;
}

export function getUserByAuthUsername(authUsername) {
  const normalized = normalizeText(authUsername).toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  const user = store.users.find((item) => normalizeText(item.authUsername).toLowerCase() === normalized);
  return sanitizeUser(user || null);
}

export function getUserRecordByAuthUsername(authUsername) {
  const normalized = normalizeText(authUsername).toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  return store.users.find((item) => normalizeText(item.authUsername).toLowerCase() === normalized) || null;
}

export function getRolesForUser(context) {
  const role = normalizeText(context?.role);
  return role && ROLE_CAPABILITIES[role] ? ROLE_CAPABILITIES[role] : [];
}

export function hasRole(context, role) {
  return normalizeText(context?.role) === normalizeText(role);
}

export function hasAnyRole(context, roles = []) {
  const currentRole = normalizeText(context?.role);
  return Array.isArray(roles) && roles.some((role) => normalizeText(role) === currentRole);
}

export function isAdminUser(context) {
  return hasRole(context, 'admin');
}

export function isManagerOrAdmin(context) {
  return hasAnyRole(context, ['admin', 'manager']);
}

export function hasCapability(context, capability) {
  const normalizedCapability = normalizeText(capability);
  if (!normalizedCapability) return false;
  return getRolesForUser(context).includes(normalizedCapability);
}

export function resolveCurrentUserContextFromAuthUsername(authUsername) {
  const user = getUserRecordByAuthUsername(authUsername);
  if (!user) return null;
  const organization = getOrganizationById(user.organizationId);
  return {
    userId: user.id,
    organizationId: user.organizationId,
    name: user.name,
    displayName: user.displayName || user.name,
    email: user.email,
    initials: user.initials,
    role: user.role,
    status: user.status,
    isAdmin: user.role === 'admin',
    isManager: user.role === 'manager',
    isSalesRep: user.role === 'sales_rep',
    organization,
  };
}

export function createUser(input, actorUserId = 'system') {
  const store = readStore();
  const normalized = assertUserInput(store, input);
  const now = nowIso();
  const actor = normalizeAuditActor(actorUserId);
  const user = {
    id: `user_${crypto.randomUUID().slice(0, 8)}`,
    organizationId: normalized.organizationId,
    name: normalized.name,
    displayName: normalized.displayName || normalized.name,
    email: normalized.email,
    initials: normalized.initials,
    role: normalized.role,
    status: normalized.status,
    createdBy: actor,
    updatedBy: actor,
    createdAt: now,
    updatedAt: now,
  };

  persist((current) => {
    current.users.unshift(user);
    return current;
  });

  return sanitizeUser(user);
}

export function updateUser(userId, updates = {}, actorUserId = 'system') {
  const store = readStore();
  const existing = requireActiveUserRecord(store, userId, updates.organizationId || null);
  const patch = { ...updates };
  delete patch.id;
  delete patch.createdAt;
  delete patch.createdBy;
  delete patch.updatedAt;
  delete patch.updatedBy;

  const nextName = patch.name ?? existing.name;
  const nextDisplayName = patch.displayName ?? (existing.displayName && existing.displayName !== existing.name ? existing.displayName : nextName);
  const nextInput = {
    organizationId: existing.organizationId,
    name: nextName,
    displayName: nextDisplayName,
    email: patch.email ?? existing.email,
    initials: patch.initials ?? existing.initials,
    role: patch.role ?? existing.role,
    status: patch.status ?? existing.status,
  };

  const normalized = assertUserInput(store, nextInput, { userId });
  assertAtLeastOneActiveAdminRemaining(store, userId, normalized.role, normalized.status);

  const now = nowIso();
  const actor = normalizeAuditActor(actorUserId);
  const nextUser = {
    ...existing,
    organizationId: normalized.organizationId,
    name: normalized.name,
    displayName: normalized.displayName || normalized.name,
    email: normalized.email,
    initials: normalized.initials,
    role: normalized.role,
    status: normalized.status,
    updatedBy: actor,
    updatedAt: now,
  };

  persist((current) => {
    const idx = current.users.findIndex((item) => item.id === userId);
    if (idx === -1) {
      const err = new Error(`User not found: ${userId}`);
      err.code = 'NOT_FOUND';
      throw err;
    }
    current.users[idx] = nextUser;
    return current;
  });

  return sanitizeUser(nextUser);
}

export function deactivateUser(userId, actorUserId = 'system') {
  return updateUser(userId, { status: 'inactive' }, actorUserId);
}

export function reactivateUser(userId, actorUserId = 'system') {
  return updateUser(userId, { status: 'active' }, actorUserId);
}

export function getSeededAdminAuthUsername() {
  return normalizeText(process.env.DASHBOARD_USERNAME) || 'ah';
}

export { DEFAULT_ORG_ID, DEFAULT_ORG_NAME, DEFAULT_ORG_SLUG, DEFAULT_ADMIN_ID, DEFAULT_TENANCY_FILE, ROLE_CAPABILITIES };
