import { createAIUsageRepository } from './currentStores/aiUsageJsonRepository.js';
import { createErrorLogRepository } from './currentStores/errorLogJsonRepository.js';
import { createIntegrationProfileRepository } from './currentStores/integrationProfileJsonRepository.js';
import { createLeadOwnershipRepository } from './currentStores/leadOwnershipJsonRepository.js';
import { createUserRepository } from './currentStores/userJsonRepository.js';
import { createAIUsageDualWriteRepository } from './dualWrite/aiUsageDualWriteRepository.js';
import { createErrorLogDualWriteRepository } from './dualWrite/errorLogDualWriteRepository.js';
import { createAIUsagePostgresRepository } from './postgres/aiUsagePostgresRepository.js';
import { createErrorLogPostgresRepository } from './postgres/errorLogPostgresRepository.js';
import { getRepositoryFeatureFlags } from './repositoryFeatureFlags.js';

function shouldUseAIUsageDualWrite(mode, flags) {
  return mode === 'dualWrite' || flags.dbWriteAIUsageEnabled || flags.dbReadAIUsageEnabled;
}

function shouldUseErrorLogDualWrite(mode, flags) {
  return mode === 'dualWrite' || flags.dbWriteErrorLogEnabled || flags.dbReadErrorLogEnabled;
}

export function createRepositories(overrides = {}) {
  const env = overrides.env || process.env;
  const mode = overrides.mode || 'current';
  const flags = getRepositoryFeatureFlags(env);
  const aiUsageCurrent = overrides.aiUsageCurrent || createAIUsageRepository(overrides.aiUsageOptions);
  const errorLogCurrent = overrides.errorLogCurrent || createErrorLogRepository(overrides.errorLogOptions);
  const aiUsagePostgres = overrides.aiUsagePostgres
    || (shouldUseAIUsageDualWrite(mode, flags)
      ? createAIUsagePostgresRepository({ ...(overrides.aiUsagePostgresOptions || {}), env })
      : null);
  const errorLogPostgres = overrides.errorLogPostgres
    || (shouldUseErrorLogDualWrite(mode, flags)
      ? createErrorLogPostgresRepository({ ...(overrides.errorLogPostgresOptions || {}), env })
      : null);

  return {
    aiUsage: overrides.aiUsage || (shouldUseAIUsageDualWrite(mode, flags)
      ? createAIUsageDualWriteRepository({
        currentRepository: aiUsageCurrent,
        postgresRepository: aiUsagePostgres,
        env,
        logger: overrides.logger,
      })
      : aiUsageCurrent),
    errorLog: overrides.errorLog || (shouldUseErrorLogDualWrite(mode, flags)
      ? createErrorLogDualWriteRepository({
        currentRepository: errorLogCurrent,
        postgresRepository: errorLogPostgres,
        env,
        logger: overrides.logger,
      })
      : errorLogCurrent),
    users: overrides.users || createUserRepository(overrides.userOptions),
    integrationProfiles: overrides.integrationProfiles
      || createIntegrationProfileRepository(overrides.integrationProfileOptions),
    leadOwnership: overrides.leadOwnership || createLeadOwnershipRepository(overrides.leadOwnershipOptions),
  };
}

let repositories = null;

export function getRepositories() {
  if (!repositories) repositories = createRepositories();
  return repositories;
}

export function resetRepositoryRegistryForTests() {
  repositories = null;
}
