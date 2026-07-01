import * as ErrorLogService from '../../services/errorLogService.js';
import { assertErrorLogRepository } from '../contracts/ErrorLogRepository.js';

function getStorageStatus(service) {
  const status = service.getErrorLogStorageStatus();
  return {
    backend: status.backend,
    configured: status.configured,
    source: status.source,
    render: status.render,
    production: status.production,
    inRepo: status.inRepo,
    writeSafe: status.writeSafe,
    warning: status.warning,
  };
}

export function createErrorLogRepository({ service = ErrorLogService } = {}) {
  return assertErrorLogRepository({
    createError: (input) => service.createError(input),
    listErrors: (filters) => service.listErrors(filters),
    getErrorById: (id) => service.getErrorDetail(id),
    updateErrorStatus: (id, status, options) => service.updateErrorStatus(id, status, options),
    markResolved: (id, options) => service.markErrorResolved(id, options),
    archive: (id, options) => service.archiveError(id, options),
    summarizeErrors: () => service.summarizeErrors(),
    findSimilarErrors: (id, limit) => service.findSimilarErrors(id, limit),
    setErrorAnalysis: (id, analysis) => service.setErrorAnalysis(id, analysis),
    getStorageStatus: () => getStorageStatus(service),
  });
}

