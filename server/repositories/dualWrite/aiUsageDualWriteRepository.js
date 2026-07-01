import { assertAIUsageRepository } from '../contracts/AIUsageRepository.js';
import { getRepositoryFeatureFlags } from '../repositoryFeatureFlags.js';

function warn(logger, code, err) {
  logger?.warn?.(`[repositoryDualWrite] ${code}: ${err?.code || err?.message || 'unknown error'}`);
}

export function createAIUsageDualWriteRepository({
  currentRepository,
  postgresRepository,
  env = process.env,
  logger = console,
} = {}) {
  return assertAIUsageRepository({
    async recordUsage(entry) {
      const currentResult = await currentRepository.recordUsage(entry);
      if (getRepositoryFeatureFlags(env).dbWriteAIUsageEnabled && currentResult) {
        try {
          await postgresRepository.recordUsage(currentResult);
        } catch (err) {
          warn(logger, 'DB_DUAL_WRITE_AI_USAGE_FAILED', err);
        }
      }
      return currentResult;
    },

    listUsage(filters) {
      if (getRepositoryFeatureFlags(env).dbReadAIUsageEnabled) {
        return postgresRepository.listUsage(filters);
      }
      return currentRepository.listUsage(filters);
    },

    summarizeUsage(filters) {
      if (getRepositoryFeatureFlags(env).dbReadAIUsageEnabled) {
        return postgresRepository.summarizeUsage(filters);
      }
      return currentRepository.summarizeUsage(filters);
    },

    getStorageStatus() {
      return {
        current: currentRepository.getStorageStatus(),
        postgres: postgresRepository.getStorageStatus(),
        flags: getRepositoryFeatureFlags(env),
      };
    },
  });
}

