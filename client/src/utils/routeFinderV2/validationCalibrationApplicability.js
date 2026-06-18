/**
 * Route Finder V2 — real-route calibration applicability (reporting only).
 * Determines which validation examples can be scored against a partial route cache.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';
import { resolveTownFromAddress } from './profileScoringModifiers.js';
import {
  buildLeadFromValidationExample,
  resolveAcceptableTechNames,
} from './validationRunner.js';
import {
  inferRouteAreaFromAddress,
} from './validationExamples.js';
import {
  isNewHampshireLead,
  resolveNhSubRegionFromLead,
} from './nhRoutingRules.js';

/**
 * @typedef {import('./validationExamples.js').RouteFinderValidationExample} RouteFinderValidationExample
 */

/**
 * @typedef {'expected_territory_not_represented'
 *   | 'route_date_mismatch'
 *   | 'expected_tech_not_scheduled'
 *   | 'expected_corridor_owner_not_scheduled'} CalibrationSkipReason
 */

/**
 * @typedef {'skipped' | 'pass' | 'true_scoring_failure'} CalibrationOutcome
 */

/**
 * @typedef {Object} CalibrationApplicabilityResult
 * @property {boolean} applicable
 * @property {CalibrationSkipReason|null} skipReason
 * @property {string|null} skipLabel
 * @property {boolean} territoryRepresented
 * @property {boolean} acceptableTechScheduled
 * @property {boolean} routeDateMismatch
 */

export const CALIBRATION_SKIP_REASON_LABELS = {
  expected_territory_not_represented: 'Expected territory not represented in selected cache',
  route_date_mismatch: 'Route date mismatch',
  expected_tech_not_scheduled: 'Expected tech not scheduled on selected date',
  expected_corridor_owner_not_scheduled: 'Skipped — expected corridor owner not scheduled',
};

export const CALIBRATION_OUTCOME_LABELS = {
  skipped: 'Skipped (not applicable)',
  pass: 'Pass',
  true_scoring_failure: 'True scoring failure',
};

function normalizeTown(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeTechName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function resolveCanonicalTechName(techName) {
  const profile = matchTechnicianProfile(techName);
  return profile?.techName ?? String(techName ?? '').trim();
}

function techNamesEquivalent(left, right) {
  return normalizeTechName(resolveCanonicalTechName(left))
    === normalizeTechName(resolveCanonicalTechName(right));
}

/**
 * @param {import('./technicianProfiles.js').TechnicianProfile} profile
 * @param {object} lead
 * @returns {boolean}
 */
export function profileCoversLeadTown(profile, lead) {
  const leadTown = normalizeTown(resolveTownFromAddress(lead.address));
  if (!leadTown) return false;

  const homeTown = normalizeTown(profile?.homeBase?.town);
  if (homeTown && (homeTown === leadTown || leadTown.includes(homeTown) || homeTown.includes(leadTown))) {
    return true;
  }

  return (profile?.normalServiceAreas ?? []).some((area) => {
    const areaTown = normalizeTown(area);
    if (!areaTown) return false;
    return areaTown === leadTown
      || leadTown.includes(areaTown)
      || areaTown.includes(leadTown);
  });
}

/**
 * @param {{ techName?: string, stops?: Array<{ address?: string }> }} tech
 * @param {string|null|undefined} leadTown
 * @returns {boolean}
 */
export function techHasStopInLeadTown(tech, leadTown) {
  const normalizedLeadTown = normalizeTown(leadTown);
  if (!normalizedLeadTown) return false;

  for (const stop of tech?.stops ?? []) {
    const stopTown = normalizeTown(resolveTownFromAddress(stop.address));
    if (stopTown && stopTown === normalizedLeadTown) return true;
  }

  return false;
}

/**
 * @param {Array<{ techName?: string, stops?: Array<{ address?: string }> }>|null|undefined} technicians
 * @param {object} lead
 * @returns {boolean}
 */
export function isTerritoryRepresentedInCache(technicians, lead) {
  if (!technicians?.length) return false;

  const leadTown = resolveTownFromAddress(lead.address);

  for (const tech of technicians) {
    const profile = matchTechnicianProfile(tech.techName);
    if (profile && profileCoversLeadTown(profile, lead)) return true;
    if (techHasStopInLeadTown(tech, leadTown)) return true;
  }

  return false;
}

/**
 * @param {Array<{ techName?: string }>|null|undefined} technicians
 * @param {RouteFinderValidationExample} example
 * @returns {boolean}
 */
export function isAcceptableTechScheduled(technicians, example) {
  const acceptableTechNames = resolveAcceptableTechNames(example);
  return acceptableTechNames.some(
    name => technicians?.some(tech => techNamesEquivalent(tech.techName, name)),
  );
}

/**
 * @param {Array<{ techName?: string }>|null|undefined} technicians
 * @param {string|null|undefined} techName
 * @returns {boolean}
 */
export function isTechnicianScheduledOnRoute(technicians, techName) {
  if (!techName || !technicians?.length) return false;
  return technicians.some(tech => techNamesEquivalent(tech.techName, techName));
}

/**
 * When neither the expected technician nor the observed winner is on the route
 * cache for the selected date, the example is not a valid routing evaluation.
 *
 * @param {RouteFinderValidationExample} example
 * @param {Array<{ techName?: string }>|null|undefined} technicians
 * @param {string|null|undefined} actualTopTechName
 * @returns {boolean}
 */
export function shouldSkipExpectedCorridorOwnerNotScheduled(
  example,
  technicians,
  actualTopTechName,
) {
  if (!actualTopTechName) return false;

  const expectedScheduled = isTechnicianScheduledOnRoute(
    technicians,
    example.expectedTechName,
  );
  const winnerScheduled = isTechnicianScheduledOnRoute(
    technicians,
    actualTopTechName,
  );

  return !expectedScheduled && !winnerScheduled;
}

/**
 * NH examples need the selected calibration date to fall on the same sub-region
 * day-of-week schedule as the example's intended route day.
 *
 * @param {RouteFinderValidationExample} example
 * @param {string|null|undefined} selectedRouteDate
 * @param {object} [lead]
 * @returns {boolean}
 */
export function hasCalibrationRouteDateMismatch(example, selectedRouteDate, lead = null) {
  if (!selectedRouteDate || example.date === selectedRouteDate) return false;

  const resolvedLead = lead ?? buildLeadFromValidationExample(example);
  if (!isNewHampshireLead(resolvedLead)) return false;

  const subRegion = resolveNhSubRegionFromLead(resolvedLead);
  if (!subRegion) return false;

  const exampleDay = new Date(`${example.date}T12:00:00`).getDay();
  const routeDay = new Date(`${selectedRouteDate}T12:00:00`).getDay();

  const exampleOnPreferredDay = subRegion.preferredRouteDays.includes(exampleDay);
  const routeOnPreferredDay = subRegion.preferredRouteDays.includes(routeDay);

  return exampleOnPreferredDay && !routeOnPreferredDay;
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {{
 *   technicians?: Array<{ techName?: string, stops?: Array<{ address?: string }> }>,
 *   lead?: object,
 *   selectedRouteDate?: string|null,
 *   actualTopTechName?: string|null,
 * }} context
 * @returns {CalibrationApplicabilityResult}
 */
export function evaluateCalibrationApplicability(example, context = {}) {
  const lead = context.lead ?? buildLeadFromValidationExample(example);
  const technicians = context.technicians ?? [];
  const selectedRouteDate = context.selectedRouteDate ?? null;
  const actualTopTechName = context.actualTopTechName ?? null;

  const territoryRepresented = isTerritoryRepresentedInCache(technicians, lead);
  const acceptableTechScheduled = isAcceptableTechScheduled(technicians, example);
  const routeDateMismatch = hasCalibrationRouteDateMismatch(example, selectedRouteDate, lead);

  if (!territoryRepresented) {
    return {
      applicable: false,
      skipReason: 'expected_territory_not_represented',
      skipLabel: CALIBRATION_SKIP_REASON_LABELS.expected_territory_not_represented,
      territoryRepresented,
      acceptableTechScheduled,
      routeDateMismatch,
    };
  }

  if (routeDateMismatch) {
    return {
      applicable: false,
      skipReason: 'route_date_mismatch',
      skipLabel: CALIBRATION_SKIP_REASON_LABELS.route_date_mismatch,
      territoryRepresented,
      acceptableTechScheduled,
      routeDateMismatch,
    };
  }

  if (!acceptableTechScheduled) {
    return {
      applicable: false,
      skipReason: 'expected_tech_not_scheduled',
      skipLabel: CALIBRATION_SKIP_REASON_LABELS.expected_tech_not_scheduled,
      territoryRepresented,
      acceptableTechScheduled,
      routeDateMismatch,
    };
  }

  if (shouldSkipExpectedCorridorOwnerNotScheduled(example, technicians, actualTopTechName)) {
    return {
      applicable: false,
      skipReason: 'expected_corridor_owner_not_scheduled',
      skipLabel: CALIBRATION_SKIP_REASON_LABELS.expected_corridor_owner_not_scheduled,
      territoryRepresented,
      acceptableTechScheduled,
      routeDateMismatch,
    };
  }

  return {
    applicable: true,
    skipReason: null,
    skipLabel: null,
    territoryRepresented,
    acceptableTechScheduled,
    routeDateMismatch,
  };
}

/**
 * @typedef {import('./validationCalibrationDiagnostics.js').RealRouteValidationRunResult} RealRouteValidationRunResult
 */

/**
 * @typedef {RealRouteValidationRunResult & {
 *   applicable: boolean,
 *   skipReason: CalibrationSkipReason|null,
 *   skipLabel: string|null,
 *   calibrationOutcome: CalibrationOutcome,
 *   countedInRealRoutePassRate: boolean,
 * }} RealRouteCalibrationResult
 */

/**
 * @typedef {Object} RealRouteSkippedExampleSummary
 * @property {string} id
 * @property {string} expectedTechName
 * @property {CalibrationSkipReason} skipReason
 * @property {string} skipLabel
 * @property {string} dispatcherReason
 * @property {string} routeDate
 * @property {number} routeTechnicianCount
 * @property {boolean} territoryRepresented
 * @property {boolean} acceptableTechScheduled
 */

/**
 * @typedef {Object} RealRouteCalibrationSummary
 * @property {number} totalExamples
 * @property {number} realRouteApplicableCount
 * @property {number} realRouteSkippedCount
 * @property {number} passed
 * @property {number} failed
 * @property {number} passRate
 * @property {RealRouteSkippedExampleSummary[]} skippedExamples
 * @property {import('./validationRunner.js').ValidationFailureSummary[]} failures
 */

/**
 * @param {RealRouteValidationRunResult} result
 * @param {CalibrationApplicabilityResult} applicability
 * @returns {RealRouteCalibrationResult}
 */
export function applyCalibrationApplicability(result, applicability) {
  if (!applicability.applicable) {
    return {
      ...result,
      applicable: false,
      skipReason: applicability.skipReason,
      skipLabel: applicability.skipLabel,
      calibrationOutcome: 'skipped',
      countedInRealRoutePassRate: false,
      territoryRepresented: applicability.territoryRepresented,
      acceptableTechScheduled: applicability.acceptableTechScheduled,
    };
  }

  return {
    ...result,
    applicable: true,
    skipReason: null,
    skipLabel: null,
    calibrationOutcome: result.passed ? 'pass' : 'true_scoring_failure',
    countedInRealRoutePassRate: true,
    territoryRepresented: applicability.territoryRepresented,
    acceptableTechScheduled: applicability.acceptableTechScheduled,
  };
}

/**
 * @param {RealRouteCalibrationResult[]} results
 * @returns {RealRouteCalibrationSummary}
 */
export function summarizeRealRouteCalibrationResults(results = []) {
  const skipped = results.filter(result => !result.applicable);
  const applicable = results.filter(result => result.applicable);
  const passed = applicable.filter(result => result.passed).length;
  const failed = applicable.length - passed;

  return {
    totalExamples: results.length,
    realRouteApplicableCount: applicable.length,
    realRouteSkippedCount: skipped.length,
    passed,
    failed,
    passRate: applicable.length ? passed / applicable.length : 0,
    skippedExamples: skipped.map(result => ({
      id: result.id,
      expectedTechName: result.expectedTechName,
      skipReason: /** @type {CalibrationSkipReason} */ (result.skipReason),
      skipLabel: result.skipLabel ?? CALIBRATION_SKIP_REASON_LABELS[result.skipReason],
      dispatcherReason: result.dispatcherReason,
      routeDate: result.routeDate,
      routeTechnicianCount: result.routeTechnicianCount,
      territoryRepresented: result.territoryRepresented ?? false,
      acceptableTechScheduled: result.acceptableTechScheduled ?? false,
    })),
    failures: applicable
      .filter(result => !result.passed)
      .map(result => ({
        id: result.id,
        expectedTechName: result.expectedTechName,
        actualTopTechName: result.actualTopTechName,
        expectedRank: result.expectedRank,
        failureReason: result.failureReason,
        dispatcherReason: result.dispatcherReason,
        topMatches: result.topMatches,
      })),
  };
}

/**
 * @param {RealRouteCalibrationResult[]} results
 * @returns {RealRouteCalibrationResult[]}
 */
export function collectApplicableRealRouteFailures(results = []) {
  return results.filter(
    result => result.applicable && result.calibrationOutcome === 'true_scoring_failure',
  );
}
