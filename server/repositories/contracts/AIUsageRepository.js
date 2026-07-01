export const AI_USAGE_REPOSITORY_METHODS = [
  'recordUsage',
  'listUsage',
  'summarizeUsage',
  'getStorageStatus',
];

export function assertAIUsageRepository(repository) {
  for (const method of AI_USAGE_REPOSITORY_METHODS) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`AIUsageRepository missing method: ${method}`);
    }
  }
  return repository;
}

