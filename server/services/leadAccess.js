import {
  getLeadOwner,
  isLeadOwnedByUser,
} from './leadOwnership.js';
import {
  isAdminUser,
  isManagerOrAdmin,
} from './organizationUsers.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseFlag(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

export function isScopedLeadAccessEnabled() {
  return parseFlag(process.env.SCOPED_LEAD_ACCESS_ENABLED);
}

function isActiveContext(context) {
  return normalizeText(context?.status) === 'active';
}

function isOrganizationLead(context, lead) {
  const owner = getLeadOwner(lead, context);
  if (!context || !owner) return false;
  return normalizeText(context.organizationId) === normalizeText(owner.organizationId);
}

function isManagerLike(context) {
  return isAdminUser(context) || isManagerOrAdmin(context);
}

export function getLeadVisibilityScope(context) {
  const enabled = isScopedLeadAccessEnabled();
  const active = isActiveContext(context);
  const organizationId = normalizeText(context?.organizationId) || null;
  const role = normalizeText(context?.role) || null;

  if (!active) {
    return {
      enabled,
      scope: 'inactive',
      role,
      organizationId,
      canViewAll: false,
      canEditAll: false,
    };
  }

  if (isManagerLike(context)) {
    return {
      enabled,
      scope: 'organization',
      role,
      organizationId,
      canViewAll: true,
      canEditAll: true,
    };
  }

  return {
    enabled,
    scope: 'owned',
    role,
    organizationId,
    canViewAll: false,
    canEditAll: false,
  };
}

export function canViewLead(context, lead) {
  if (!isActiveContext(context) || !lead) return false;
  if (!isOrganizationLead(context, lead)) return false;
  if (isManagerLike(context)) return true;
  return isLeadOwnedByUser(context, lead);
}

export function canEditLead(context, lead) {
  if (!isActiveContext(context) || !lead) return false;
  if (!isOrganizationLead(context, lead)) return false;
  if (isManagerLike(context)) return true;
  return isLeadOwnedByUser(context, lead);
}

export function assertCanViewLead(context, lead) {
  if (canViewLead(context, lead)) return true;
  const err = new Error('Lead access denied.');
  err.code = normalizeText(context?.status) === 'active' ? 'LEAD_ACCESS_DENIED' : 'USER_INACTIVE';
  err.status = 403;
  throw err;
}

export function assertCanEditLead(context, lead) {
  if (canEditLead(context, lead)) return true;
  const err = new Error('Lead edit access denied.');
  err.code = normalizeText(context?.status) === 'active' ? 'LEAD_ACCESS_DENIED' : 'USER_INACTIVE';
  err.status = 403;
  throw err;
}

export function decorateLeadVisibility(context, lead) {
  if (!lead || typeof lead !== 'object') return lead;
  const owner = getLeadOwner(lead, context);
  const visibility = getLeadVisibilityScope(context);
  return {
    ...lead,
    ownership: owner ? {
      organizationId: owner.organizationId,
      ownerUserId: owner.ownerUserId,
      createdBy: owner.createdBy,
      updatedBy: owner.updatedBy,
      createdAt: owner.createdAt,
      updatedAt: owner.updatedAt,
      source: owner.source,
    } : null,
    visibility: {
      canView: canViewLead(context, lead),
      canEdit: canEditLead(context, lead),
      scope: visibility.scope,
    },
  };
}

export function filterLeadsForUser(context, leads = []) {
  const rows = Array.isArray(leads) ? leads : [];
  const decorated = rows.map((lead) => decorateLeadVisibility(context, lead));
  if (!isScopedLeadAccessEnabled()) return decorated;
  if (!isActiveContext(context)) return [];

  const visibility = getLeadVisibilityScope(context);
  if (visibility.canViewAll) return decorated;
  return decorated.filter((lead) => lead.visibility?.canView);
}
