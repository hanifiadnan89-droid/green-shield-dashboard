import * as ErrorLogService from './errorLogService.js';
import { createErrorLogRepository } from '../repositories/currentStores/errorLogJsonRepository.js';
import { createErrorLogDualWriteRepository } from '../repositories/dualWrite/errorLogDualWriteRepository.js';
import { getRepositoryFeatureFlags } from '../repositories/repositoryFeatureFlags.js';

function safeWarn(logger, err) {
  logger?.warn?.(`[repositoryDualWrite] DB_DUAL_WRITE_ERROR_LOG_FAILED: ${err?.code || err?.message || 'unknown error'}`);
}

async function defaultPostgresRepositoryFactory(env) {
  const { createErrorLogPostgresRepository } = await import('../repositories/postgres/errorLogPostgresRepository.js');
  return createErrorLogPostgresRepository({ env });
}

export function createErrorLogRecorder({
  currentService = ErrorLogService,
  currentRepository = null,
  postgresRepository = null,
  postgresRepositoryFactory = defaultPostgresRepositoryFactory,
  env = process.env,
  logger = console,
} = {}) {
  function getCurrentRepository() {
    return currentRepository || createErrorLogRepository({ service: currentService });
  }

  async function getPostgresRepository() {
    return postgresRepository || postgresRepositoryFactory(env);
  }

  function createError(input = {}) {
    const flags = getRepositoryFeatureFlags(env);
    if (!flags.dbWriteErrorLogEnabled) {
      return currentService.createError(input);
    }

    const currentResult = currentService.createError(input);
    if (!currentResult) return currentResult;

    Promise.resolve()
      .then(async () => {
        const dualWriteRepository = createErrorLogDualWriteRepository({
          currentRepository: {
            ...getCurrentRepository(),
            createError: () => currentResult,
          },
          postgresRepository: await getPostgresRepository(),
          env,
          logger,
        });
        await dualWriteRepository.createError(currentResult);
      })
      .catch((err) => safeWarn(logger, err));

    return currentResult;
  }

  async function listErrors(filters = {}) {
    if (!getRepositoryFeatureFlags(env).dbReadErrorLogEnabled) {
      return currentService.listErrors(filters);
    }
    const postgres = await getPostgresRepository();
    return postgres.listErrors(filters);
  }

  async function getErrorDetail(id) {
    if (!getRepositoryFeatureFlags(env).dbReadErrorLogEnabled) {
      return currentService.getErrorDetail(id);
    }
    const postgres = await getPostgresRepository();
    return postgres.getErrorById(id);
  }

  function updateErrorStatus(id, status, options = {}) {
    return currentService.updateErrorStatus(id, status, options);
  }

  function markErrorResolved(id, options = {}) {
    return currentService.markErrorResolved(id, options);
  }

  function archiveError(id, options = {}) {
    return currentService.archiveError(id, options);
  }

  async function summarizeErrors() {
    if (!getRepositoryFeatureFlags(env).dbReadErrorLogEnabled) {
      return currentService.summarizeErrors();
    }
    const postgres = await getPostgresRepository();
    return postgres.summarizeErrors();
  }

  async function findSimilarErrors(id, limit) {
    if (!getRepositoryFeatureFlags(env).dbReadErrorLogEnabled) {
      return currentService.findSimilarErrors(id, limit);
    }
    const postgres = await getPostgresRepository();
    return postgres.findSimilarErrors(id, limit);
  }

  function setErrorAnalysis(id, analysis) {
    return currentService.setErrorAnalysis(id, analysis);
  }

  function getErrorLogStorageStatus() {
    return currentService.getErrorLogStorageStatus();
  }

  function initializeErrorLogStorage() {
    return currentService.initializeErrorLogStorage();
  }

  return {
    archiveError,
    createError,
    findSimilarErrors,
    getErrorDetail,
    getErrorLogStorageStatus,
    initializeErrorLogStorage,
    listErrors,
    markErrorResolved,
    setErrorAnalysis,
    summarizeErrors,
    updateErrorStatus,
  };
}

const defaultRecorder = createErrorLogRecorder();

export const archiveError = (id, options) => defaultRecorder.archiveError(id, options);
export const createError = (input) => defaultRecorder.createError(input);
export const findSimilarErrors = (id, limit) => defaultRecorder.findSimilarErrors(id, limit);
export const getErrorDetail = (id) => defaultRecorder.getErrorDetail(id);
export const getErrorLogStorageStatus = () => defaultRecorder.getErrorLogStorageStatus();
export const initializeErrorLogStorage = () => defaultRecorder.initializeErrorLogStorage();
export const listErrors = (filters) => defaultRecorder.listErrors(filters);
export const markErrorResolved = (id, options) => defaultRecorder.markErrorResolved(id, options);
export const setErrorAnalysis = (id, analysis) => defaultRecorder.setErrorAnalysis(id, analysis);
export const summarizeErrors = () => defaultRecorder.summarizeErrors();
export const updateErrorStatus = (id, status, options) => defaultRecorder.updateErrorStatus(id, status, options);

export default defaultRecorder;
