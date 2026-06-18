/**
 * Route Finder V2 configuration barrel export.
 * Config modules are not wired into live scoring yet.
 */

export {
  TECHNICIAN_PROFILES,
  getTechnicianProfile,
  matchTechnicianProfile,
  hasTechnicianProfile,
  getAllTechnicianProfiles,
} from './technicianProfiles.js';

export {
  SERVICE_DURATION_RULES,
  getServiceDuration,
  getServiceBuffer,
  resolveLeadServiceTypeKey,
  resolveServiceDurationFromLead,
} from './serviceDurations.js';

export {
  TIME_WINDOW_RULES,
  getTimeWindowRule,
  parseRouteFinderWindow,
  isHardWindow,
  isSoftWindow,
} from './timeWindowRules.js';

export {
  V2_SCORING_WEIGHTS,
  V2_PENALTY_CONFIG,
  getV2ScoringWeights,
  getV2PenaltyConfig,
  sumV2ScoringWeights,
} from './scoringWeights.js';

export {
  REGION_RULES,
  getRegionRule,
  getAllRegionRules,
} from './regionRules.js';

export {
  PRIORITY_RULES,
  getPriorityRule,
  getAllPriorityRules,
} from './priorityRules.js';

export {
  ROUTE_FINDER_VALIDATION_EXAMPLES,
  getValidationExamples,
} from './validationExamples.js';

export {
  buildMatchV2Profile,
  evaluateServiceAreaMatch,
  enrichScoringResultWithV2Profiles,
  reorderMatchesByEligibility,
  resolveProjectedStopCount,
  summarizeV2ProfileStats,
} from './technicianEligibility.js';
