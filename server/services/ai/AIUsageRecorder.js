import * as AIUsageLogService from './AIUsageLogService.js';
import { createAIUsageRepository } from '../../repositories/currentStores/aiUsageJsonRepository.js';
import { createAIUsageDualWriteRepository } from '../../repositories/dualWrite/aiUsageDualWriteRepository.js';
import { getRepositoryFeatureFlags } from '../../repositories/repositoryFeatureFlags.js';

function safeWarn(logger, err) {
  logger?.warn?.(`[repositoryDualWrite] DB_DUAL_WRITE_AI_USAGE_FAILED: ${err?.code || err?.message || 'unknown error'}`);
}

// One-shot per recorder instance so a Render service that has writeSafe=false
// logs the diagnostic once, not on every AI request.
function makeOneShotWarner(logger) {
  let logged = false;
  return (message) => {
    if (logged) return;
    logged = true;
    logger?.warn?.(message);
  };
}

async function defaultPostgresRepositoryFactory(env) {
  const { createAIUsagePostgresRepository } = await import('../../repositories/postgres/aiUsagePostgresRepository.js');
  return createAIUsagePostgresRepository({ env });
}

export function createAIUsageRecorder({
  currentService = AIUsageLogService,
  currentRepository = null,
  postgresRepository = null,
  postgresRepositoryFactory = defaultPostgresRepositoryFactory,
  env = process.env,
  logger = console,
} = {}) {
  const warnCurrentSkippedOnce = makeOneShotWarner(logger);

  function getCurrentRepository() {
    return currentRepository || createAIUsageRepository({ service: currentService });
  }

  async function getPostgresRepository() {
    return postgresRepository || postgresRepositoryFactory(env);
  }

  function schedulePostgresShadowWrite(entryForPostgres) {
    Promise.resolve()
      .then(async () => {
        const postgres = await getPostgresRepository();
        await postgres.recordUsage(entryForPostgres);
      })
      .catch((err) => safeWarn(logger, err));
  }

  function recordAIUsage(entry = {}) {
    const flags = getRepositoryFeatureFlags(env);
    if (!flags.dbWriteAIUsageEnabled) {
      return currentService.recordAIUsage(entry);
    }

    const currentResult = currentService.recordAIUsage(entry);

    if (!currentResult) {
      // Current store refused the write (writeSafe=false on Render staging
      // when the persistent-disk backend is unconfigured). Build a shaped
      // entry ourselves so the Postgres shadow-write still lands, using the
      // same normalization the current store would have applied. Keeps
      // DB_WRITE_AI_USAGE_ENABLED=true meaningful during burn-in without
      // making Postgres required for AI responses.
      warnCurrentSkippedOnce(
        '[aiUsageRecorder] current-store write skipped; postgres shadow-write still attempted because DB_WRITE_AI_USAGE_ENABLED=true',
      );
      let entryForPostgres = null;
      try {
        entryForPostgres = currentService.buildAIUsageEntry
          ? currentService.buildAIUsageEntry(entry)
          : null;
      } catch (buildErr) {
        safeWarn(logger, buildErr);
      }
      if (entryForPostgres && entryForPostgres.id) {
        schedulePostgresShadowWrite(entryForPostgres);
      }
      return currentResult;
    }

    Promise.resolve()
      .then(async () => {
        const dualWriteRepository = createAIUsageDualWriteRepository({
          currentRepository: {
            ...getCurrentRepository(),
            recordUsage: () => currentResult,
          },
          postgresRepository: await getPostgresRepository(),
          env,
          logger,
        });
        await dualWriteRepository.recordUsage(currentResult);
      })
      .catch((err) => safeWarn(logger, err));

    return currentResult;
  }

  async function listAIUsage(filters = {}) {
    const flags = getRepositoryFeatureFlags(env);
    if (!flags.dbReadAIUsageEnabled) {
      return currentService.listAIUsage(filters);
    }
    const postgres = await getPostgresRepository();
    return postgres.listUsage(filters);
  }

  async function summarizeAIUsage(filters = {}) {
    const flags = getRepositoryFeatureFlags(env);
    if (!flags.dbReadAIUsageEnabled) {
      return currentService.summarizeAIUsage(filters);
    }
    const postgres = await getPostgresRepository();
    return postgres.summarizeUsage(filters);
  }

  function getSafeAIUsageLogStorageStatus() {
    return currentService.getSafeAIUsageLogStorageStatus();
  }

  return {
    recordAIUsage,
    listAIUsage,
    summarizeAIUsage,
    getSafeAIUsageLogStorageStatus,
  };
}

const defaultRecorder = createAIUsageRecorder();

export const recordAIUsage = (entry) => defaultRecorder.recordAIUsage(entry);
export const listAIUsage = (filters) => defaultRecorder.listAIUsage(filters);
export const summarizeAIUsage = (filters) => defaultRecorder.summarizeAIUsage(filters);
export const getSafeAIUsageLogStorageStatus = () => defaultRecorder.getSafeAIUsageLogStorageStatus();

export default defaultRecorder;
