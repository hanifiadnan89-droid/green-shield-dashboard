import { checkCredentials } from '../security/dashboardAuth.js';
import {
  buildSessionIdentity,
  getUserRecordById,
  resolveCurrentUserContextFromSession,
  verifyInternalUserPassword,
} from './organizationUsers.js';

export async function authenticateDashboardLogin(username, password) {
  const internalAuth = await verifyInternalUserPassword(username, password);
  if (internalAuth.ok) {
    return {
      ok: true,
      method: 'internal_user',
      sessionIdentity: internalAuth.sessionIdentity,
    };
  }

  if (checkCredentials(username, password)) {
    // Break-glass only: legacy env credentials map to AH and do not create,
    // modify, or backfill any internal user password fields.
    const sessionIdentity = buildSessionIdentity(getUserRecordById('user_ah'));
    if (sessionIdentity) {
      return {
        ok: true,
        method: 'env_break_glass',
        sessionIdentity,
      };
    }
  }

  return { ok: false, code: 'INVALID_CREDENTIALS' };
}

export function resolveLoginSessionContext(session) {
  return resolveCurrentUserContextFromSession(session);
}
