export const ERROR_LOG_REPOSITORY_METHODS = [
  'createError',
  'listErrors',
  'getErrorById',
  'updateErrorStatus',
  'markResolved',
  'archive',
  'summarizeErrors',
  'findSimilarErrors',
  'setErrorAnalysis',
  'getStorageStatus',
];

export function assertErrorLogRepository(repository) {
  for (const method of ERROR_LOG_REPOSITORY_METHODS) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`ErrorLogRepository missing method: ${method}`);
    }
  }
  return repository;
}

