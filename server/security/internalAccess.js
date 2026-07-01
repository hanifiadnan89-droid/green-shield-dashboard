import {
  getCurrentUserContext,
} from '../services/currentUserContext.js';
import {
  hasCapability,
  hasRole,
  hasAnyRole,
  isAdminUser,
  isManagerOrAdmin,
} from '../services/organizationUsers.js';

function sendForbidden(res, message, code = 'FORBIDDEN') {
  return res.status(403).json({ error: message, code });
}

export function requireActiveUser(req, res, next) {
  const context = getCurrentUserContext(req);
  if (!context) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (context.status !== 'active') {
    return sendForbidden(res, 'This user account is inactive.', 'USER_INACTIVE');
  }
  return next();
}

export function requireAdmin(req, res, next) {
  const context = getCurrentUserContext(req);
  if (!context) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (context.status !== 'active') {
    return sendForbidden(res, 'This user account is inactive.', 'USER_INACTIVE');
  }
  if (!isAdminUser(context)) {
    return sendForbidden(res, 'Admin access required.', 'ADMIN_REQUIRED');
  }
  return next();
}

export function requireManagerOrAdmin(req, res, next) {
  const context = getCurrentUserContext(req);
  if (!context) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (context.status !== 'active') {
    return sendForbidden(res, 'This user account is inactive.', 'USER_INACTIVE');
  }
  if (!isManagerOrAdmin(context)) {
    return sendForbidden(res, 'Manager or admin access required.', 'MANAGER_REQUIRED');
  }
  return next();
}

export function canViewAllUsers(context) {
  return hasCapability(context, 'view_users');
}

export function canViewOwnData(context, ownerUserId) {
  if (!context || !ownerUserId) return false;
  return context.userId === ownerUserId;
}

export function hasRoleCapability(context, capability) {
  return hasCapability(context, capability);
}

export function isAdminOrManager(context) {
  return isManagerOrAdmin(context);
}

export { hasRole, hasAnyRole, isAdminUser, isManagerOrAdmin, hasCapability };
