import { assertErrorLogRepository } from '../contracts/ErrorLogRepository.js';
import { getRepositoryFeatureFlags } from '../repositoryFeatureFlags.js';

function warn(logger, code, err) {
  logger?.warn?.(`[repositoryDualWrite] ${code}: ${err?.code || err?.message || 'unknown error'}`);
}

export function createErrorLogDualWriteRepository({
  currentRepository,
  postgresRepository,
  env = process.env,
  logger = console,
} = {}) {
  return assertErrorLogRepository({
    async createError(input) {
      const currentResult = await currentRepository.createError(input);
      if (getRepositoryFeatureFlags(env).dbWriteErrorLogEnabled && currentResult) {
        try {
          await postgresRepository.createError(currentResult);
        } catch (err) {
          warn(logger, 'DB_DUAL_WRITE_ERROR_LOG_FAILED', err);
        }
      }
      return currentResult;
    },

    listErrors(filters) {
      if (getRepositoryFeatureFlags(env).dbReadErrorLogEnabled) {
        return postgresRepository.listErrors(filters);
      }
      return currentRepository.listErrors(filters);
    },

    getErrorById(id) {
      if (getRepositoryFeatureFlags(env).dbReadErrorLogEnabled) {
        return postgresRepository.getErrorById(id);
      }
      return currentRepository.getErrorById(id);
    },

    updateErrorStatus(id, status, options) {
      return currentRepository.updateErrorStatus(id, status, options);
    },

    markResolved(id, options) {
      return currentRepository.markResolved(id, options);
    },

    archive(id, options) {
      return currentRepository.archive(id, options);
    },

    summarizeErrors() {
      if (getRepositoryFeatureFlags(env).dbReadErrorLogEnabled) {
        return postgresRepository.summarizeErrors();
      }
      return currentRepository.summarizeErrors();
    },

    findSimilarErrors(id, limit) {
      if (getRepositoryFeatureFlags(env).dbReadErrorLogEnabled) {
        return postgresRepository.findSimilarErrors(id, limit);
      }
      return currentRepository.findSimilarErrors(id, limit);
    },

    setErrorAnalysis(id, analysis) {
      return currentRepository.setErrorAnalysis(id, analysis);
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

