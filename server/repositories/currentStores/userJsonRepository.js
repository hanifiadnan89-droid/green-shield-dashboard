import * as OrganizationUsers from '../../services/organizationUsers.js';
import { assertUserRepository } from '../contracts/UserRepository.js';

export function createUserRepository({ service = OrganizationUsers } = {}) {
  return assertUserRepository({
    listOrganizations: () => service.listOrganizations(),
    getOrganizationById: (id) => service.getOrganizationById(id),
    getDefaultOrganization: () => service.getDefaultOrganization(),
    listUsers: (options) => service.listUsers(options),
    getUserById: (id) => service.getUserById(id),
    getUserRecordById: (id) => service.getUserRecordById(id),
    findUserByAuthUsername: (username) => service.getUserByAuthUsername(username),
    findUserRecordByAuthUsername: (username) => service.getUserRecordByAuthUsername(username),
    resolveCurrentUserContextFromAuthUsername: (username) =>
      service.resolveCurrentUserContextFromAuthUsername(username),
    createUser: (input, actorUserId) => service.createUser(input, actorUserId),
    updateUser: (id, patch, actorUserId) => service.updateUser(id, patch, actorUserId),
    deactivateUser: (id, actorUserId) => service.deactivateUser(id, actorUserId),
    reactivateUser: (id, actorUserId) => service.reactivateUser(id, actorUserId),
    ensureStore: () => service.ensureInternalTenancy(),
    getSnapshot: () => service.getInternalTenancySnapshot(),
  });
}

