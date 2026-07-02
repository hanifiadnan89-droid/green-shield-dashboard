import { getBreakGlassAuthUsername, getSessionFromRequest, isAuthenticatedRequest } from '../security/dashboardAuth.js';
import {
  resolveBreakGlassCurrentUserContext,
  resolveCurrentUserContextFromAuthUsername,
  resolveCurrentUserContextFromSession,
} from './organizationUsers.js';
import { getIntegrationProfile } from './organizationIntegrations.js';
import { canViewLead as canViewLeadByOwnership, canEditLead as canEditLeadByOwnership, isLeadOwnedByUser } from './leadOwnership.js';

export function getAuthUsernameFromRequest(req) {
  const session = getSessionFromRequest(req);
  if (session?.u) return session.u;
  if (isAuthenticatedRequest(req)) {
    return getBreakGlassAuthUsername();
  }
  return null;
}

export function getCurrentUserContext(req) {
  if (req?.currentUserContext) return req.currentUserContext;
  const session = getSessionFromRequest(req);
  const isBreakGlassBasicAuth = !session && isAuthenticatedRequest(req);
  const authUsername = (session?.u || isBreakGlassBasicAuth) ? null : getAuthUsernameFromRequest(req);

  const context = session
    ? resolveCurrentUserContextFromSession(session)
    : isBreakGlassBasicAuth
      ? resolveBreakGlassCurrentUserContext()
      : resolveCurrentUserContextFromAuthUsername(authUsername);
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
