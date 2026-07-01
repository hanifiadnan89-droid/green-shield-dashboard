export const USER_REPOSITORY_METHODS = [
  'listOrganizations',
  'getOrganizationById',
  'getDefaultOrganization',
  'listUsers',
  'getUserById',
  'getUserRecordById',
  'findUserByAuthUsername',
  'findUserRecordByAuthUsername',
  'resolveCurrentUserContextFromAuthUsername',
  'createUser',
  'updateUser',
  'deactivateUser',
  'reactivateUser',
  'ensureStore',
  'getSnapshot',
];

export function assertUserRepository(repository) {
  for (const method of USER_REPOSITORY_METHODS) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`UserRepository missing method: ${method}`);
    }
  }
  return repository;
}

