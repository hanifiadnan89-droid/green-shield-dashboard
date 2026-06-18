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

export { technicians as ROUTE_FINDER_TECHNICIAN_ROSTER } from './technicianRosterSource.js';

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
  SERVICE_AREA_GROUPS,
  getRegionRule,
  getAllRegionRules,
  getServiceAreaGroup,
  getAllServiceAreaGroups,
  resolveServiceAreaGroupForTown,
  resolveServiceAreaGroupFromAddress,
} from './regionRules.js';

export {
  PRIORITY_RULES,
  getPriorityRule,
  getAllPriorityRules,
} from './priorityRules.js';

export {
  ROUTE_FINDER_VALIDATION_EXAMPLES,
  VALIDATION_SERVICE_TYPES,
  getValidationExamples,
  getValidationExampleById,
  getValidationExampleCount,
  isValidValidationServiceType,
  resolveAcceptedRankMax,
  inferRouteAreaFromAddress,
} from './validationExamples.js';

export {
  buildMatchV2Profile,
  evaluateServiceAreaMatch,
  enrichScoringResultWithV2Profiles,
  reorderMatchesByEligibility,
  resolveProjectedStopCount,
  summarizeV2ProfileStats,
} from './technicianEligibility.js';

export {
  buildMatchV2Score,
  enrichScoringResultWithV2Scores,
  reorderMatchesByV2Score,
  logV2ScoreRankChanges,
  resolveLeadTown,
  resolveTownFromAddress,
  isLeadInNormalServiceAreas,
  isStrongGeoCluster,
  isWeakGeoCluster,
  matchHasSameTownRouteStop,
} from './profileScoringModifiers.js';

export {
  TERRITORY_OWNERSHIP_POINTS,
  TOWN_PRIMARY_CORRIDOR_OWNERS,
  resolvePrimaryCorridorOwners,
  isPrimaryCorridorOwner,
  findAvailablePrimaryCorridorOwners,
  buildTerritoryOwnershipModifiers,
  mergeTerritoryOwnershipIntoV2Score,
} from './territoryOwnership.js';

export {
  evaluateValidationExample,
  evaluateValidationExamples,
  buildValidationTopMatchDiagnostic,
  buildLeadFromValidationExample,
  mapValidationTimePreference,
  resolveScoringTopMatches,
  resolveAcceptableTechNames,
  printValidationResult,
  summarizeValidationResults,
  printValidationSummary,
  getValidationPassRate,
} from './validationRunner.js';

export {
  runValidationReport,
  printValidationBaselineReport,
  formatValidationBaselineReport,
  formatValidationPassRate,
  isValidationReportAllowed,
  assertValidationReportDevOnly,
} from './runValidationReport.js';

export {
  runValidationCalibration,
  formatValidationCalibrationReport,
  printValidationCalibrationReport,
} from './runValidationCalibration.js';

export {
  loadNormalizedRoutesForDate,
  loadNormalizedRoutesFromDisk,
  listCachedRouteDates,
  findMostCompleteCachedRouteDate,
  resolveCalibrationRouteDateForRun,
  resolveRequestedCalibrationRouteDate,
  parseCalibrationRouteDateFromArgv,
  isValidCalibrationRouteDate,
  pickCalibrationRouteDateFromList,
  summarizeNormalizedRoutePayload,
  resolveCalibrationRouteDate,
  createRouteLoader,
  resolveNormalizedRouteCachePath,
  DEFAULT_CALIBRATION_ROUTE_DATE,
  CALIBRATION_ROUTE_DATE_ENV,
} from './realRouteCalibrationSource.js';

export {
  enrichRealRouteValidationResult,
  buildRealRouteCandidateDiagnostic,
  buildRealRouteTopCandidates,
  collectRealRouteFailures,
  buildRealRouteFailureSummary,
  extractDayMismatchWarnings,
} from './validationCalibrationDiagnostics.js';

export {
  VALIDATION_FAILURE_PATTERN_LABELS,
  classifyRealRouteFailurePatterns,
  buildValidationFailurePatternReport,
  formatValidationFailurePatternReport,
  scoreFailurePriority,
} from './validationFailurePatterns.js';

export {
  FAILURE_CLASSIFICATION_LABELS,
  DISPATCHER_CONFIDENCE_LABELS,
  areNeighboringTechSubstitutionPair,
  classifyDispatcherConfidence,
  isWinnerClearlyOutsideServiceCorridor,
  summarizeDispatcherConfidence,
} from './dispatcherConfidenceClassification.js';

export {
  extractClassifiedFailuresFromReport,
  findRepeatedHighConfidenceMistakes,
  formatMultiDateCalibrationReport,
  summarizeMultiDateCalibration,
} from './summarizeMultiDateCalibration.js';

export {
  readViteEnv,
  isViteDevRuntime,
  isViteProdRuntime,
  isViteEnvFlagEnabled,
} from './viteRuntimeEnv.js';

export {
  buildFailureScoreComparison,
  buildHighConfidenceFailureComparisons,
  buildTechnicianScoreSnapshot,
  explainWhyWinnerBeatExpected,
  findTechnicianScoreSnapshot,
  formatFailureScoreComparisonTable,
  formatHighConfidenceFailureComparisonReport,
  scoreExampleForFailureComparison,
  sumModifierPoints,
} from './validationFailureScoreComparison.js';

export {
  buildHighConfidenceFailureComparisonsWithRescore,
  formatHighConfidenceFailureComparisonReportFromComparisons,
} from './buildHighConfidenceFailureComparisons.js';

export {
  CALIBRATION_SKIP_REASON_LABELS,
  CALIBRATION_OUTCOME_LABELS,
  applyCalibrationApplicability,
  collectApplicableRealRouteFailures,
  evaluateCalibrationApplicability,
  hasCalibrationRouteDateMismatch,
  isAcceptableTechScheduled,
  isTerritoryRepresentedInCache,
  profileCoversLeadTown,
  summarizeRealRouteCalibrationResults,
} from './validationCalibrationApplicability.js';

export {
  NH_APPROVED_TECHNICIAN_NAMES,
  NH_FORBIDDEN_TECHNICIAN_NAMES,
  NH_SUB_REGION_RULES,
  evaluateLeadNhRoutingContext,
  evaluateNhRouteDayMatch,
  evaluateNhTechnicianRoutingContext,
  getAllNhSubRegionRules,
  getV2ScorerConfigForLead,
  isNhApprovedTechnician,
  isNhForbiddenTechnician,
  isNewHampshireLead,
  resolveNhSubRegionForTown,
  resolveNhSubRegionFromLead,
} from './nhRoutingRules.js';
