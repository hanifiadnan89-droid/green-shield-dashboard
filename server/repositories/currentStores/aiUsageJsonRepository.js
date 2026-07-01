import * as AIUsageLogService from '../../services/ai/AIUsageLogService.js';
import { assertAIUsageRepository } from '../contracts/AIUsageRepository.js';

export function createAIUsageRepository({ service = AIUsageLogService } = {}) {
  return assertAIUsageRepository({
    recordUsage: (entry) => service.recordAIUsage(entry),
    listUsage: (filters) => service.listAIUsage(filters),
    summarizeUsage: (filters) => service.summarizeAIUsage(filters),
    getStorageStatus: () => service.getSafeAIUsageLogStorageStatus(),
  });
}

