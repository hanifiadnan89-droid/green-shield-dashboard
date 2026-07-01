import { getSessionFromRequest, isAuthenticatedRequest } from '../security/dashboardAuth.js';
import { resolveCurrentUserContextFromAuthUsername } from './organizationUsers.js';
import { getIntegrationProfile } from './organizationIntegrations.js';
import { canViewLead as canViewLeadByOwnership, canEditLead as canEditLeadByOwnership, isLeadOwnedByUser } from './leadOwnership.js';

export function getAuthUsernameFromRequest(req) {
  const session = getSessionFromRequest(req);
  if (session?.u) return session.u;
  if (isAuthenticatedRequest(req)) {
    return (process.env.DASHBOARD_USERNAME || '').trim() || null;
  }
  return null;
}

export function getCurrentUserContext(req) {
  if (req?.currentUserContext) return req.currentUserContext;
  const authUsername = getAuthUsernameFromRequest(req);
  if (!authUsername) return null;

  const context = resolveCurrentUserContextFromAuthUsername(authUsername);
  if (!context) return null;
  context.integrationProfile = getIntegrationProfile(context.userId);
  context.ownsLead = (lead) => isLeadOwnedByUser(context, lead);
  context.canViewLead = (lead) => canViewLeadByOwnership(context, lead);
  context.canEditLead = (lead) => canEditLeadByOwnership(context, lead);

  if (req) {
    req.currentUserContext = context;
  }

  return context;
}

export function attachCurrentUserContext(req, res, next) {
  req.currentUserContext = getCurrentUserContext(req);
  next();
}
