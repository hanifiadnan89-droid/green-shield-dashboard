export const INTEGRATION_PROFILE_REPOSITORY_METHODS = [
  'listIntegrationProfiles',
  'getIntegrationProfileForUser',
  'getIntegrationProfileRecordForUser',
  'createIntegrationProfile',
  'updateIntegrationProfile',
  'validateIntegrationProfile',
  'ensureStore',
  'getSnapshot',
];

export function assertIntegrationProfileRepository(repository) {
  for (const method of INTEGRATION_PROFILE_REPOSITORY_METHODS) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`IntegrationProfileRepository missing method: ${method}`);
    }
  }
  return repository;
}

