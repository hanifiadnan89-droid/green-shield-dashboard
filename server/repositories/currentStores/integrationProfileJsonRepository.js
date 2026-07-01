import * as OrganizationIntegrations from '../../services/organizationIntegrations.js';
import { assertIntegrationProfileRepository } from '../contracts/IntegrationProfileRepository.js';

export function createIntegrationProfileRepository({ service = OrganizationIntegrations } = {}) {
  return assertIntegrationProfileRepository({
    listIntegrationProfiles: (options) => service.listIntegrationProfiles(options),
    getIntegrationProfileForUser: (userId) => service.getIntegrationProfile(userId),
    getIntegrationProfileRecordForUser: (userId) => service.getIntegrationProfileRecord(userId),
    createIntegrationProfile: (userId, input, actorUserId) =>
      service.createIntegrationProfile(userId, input, actorUserId),
    updateIntegrationProfile: (userId, patch, actorUserId) =>
      service.updateIntegrationProfile(userId, patch, actorUserId),
    validateIntegrationProfile: (profile) => service.validateIntegrationProfile(profile),
    ensureStore: () => service.ensureOrganizationIntegrations(),
    getSnapshot: () => service.getOrganizationIntegrationsSnapshot(),
  });
}

