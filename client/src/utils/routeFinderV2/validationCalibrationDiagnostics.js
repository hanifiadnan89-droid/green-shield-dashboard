/**
 * Route Finder V2 — enriched diagnostics for real-route calibration failures.
 */

import {
  buildValidationTopMatchDiagnostic,
  resolveScoringTopMatches,
} from './validationRunner.js';
import { resolveProjectedStopCount } from './technicianEligibility.js';

/**
 * @typedef {import('./validationRunner.js').ValidationRunResult} ValidationRunResult
 * @typedef {import('./validationRunner.js').ValidationTopMatchDiagnostic} ValidationTopMatchDiagnostic
 */

/**
 * @typedef {Object} RealRouteCandidateDiagnostic
 * @property {number} rank
 * @property {string} techName
 * @property {number} stopCount
 * @property {number} baseTotal
 * @property {number} adjustedTotal
 * @property {string} eligibilityStatus
 * @property {boolean} overPreferredMaxStops
 * @property {boolean} overHardMaxStops
 * @property {string[]} dayMismatchWarnings
 * @property {Array<{ code: string, label: string, points: number }>} penalties
 * @property {Array<{ code: string, label: string, points: number }>} bonuses
 */

/**
 * @typedef {Object} RealRouteValidationRunResult
 * @property {string} routeDate
 * @property {number} routeTechnicianCount
 * @property {number|null} topTechStopCount
 * @property {boolean|null} topTechOverPreferredMax
 * @property {boolean|null} topTechOverHardMax
 * @property {string[]} dayMismatchWarnings
 * @property {RealRouteCandidateDiagnostic[]} topCandidates
 * @extends {ValidationRunResult}
 */

/**
 * @typedef {RealRouteValidationRunResult & {
 *   id: string,
 *   expectedTechName: string,
 *   actualTopTechName: string|null,
 *   expectedRank: number|null,
 *   failureReason: string|null,
 *   dispatcherReason: string,
 *   topMatches: ValidationTopMatchDiagnostic[],
 * }} RealRouteValidationFailureSummary
 */

const TOP_CANDIDATE_LIMIT = 3;

/**
 * @param {object|null|undefined} v2Profile
 * @returns {string[]}
 */
export function extractDayMismatchWarnings(v2Profile) {
  const warnings = Array.isArray(v2Profile?.warnings) ? v2Profile.warnings : [];
  return warnings.filter(warning => /route day|sub-region|nh/i.test(String(warning)));
}

/**
 * @param {object} match
 * @param {number} rank
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>|null|undefined} technicians
 * @returns {RealRouteCandidateDiagnostic}
 */
export function buildRealRouteCandidateDiagnostic(match, rank, technicians) {
  const v2Profile = match?.v2Profile ?? {};
  const v2Score = match?.v2Score ?? {};
  const topMatch = buildValidationTopMatchDiagnostic(match, rank);

  return {
    rank,
    techName: topMatch.techName,
    stopCount: resolveProjectedStopCount(match, technicians) - 1,
    baseTotal: topMatch.baseTotal,
    adjustedTotal: topMatch.adjustedTotal,
    eligibilityStatus: topMatch.eligibilityStatus,
    overPreferredMaxStops: Boolean(v2Profile.overPreferredMaxStops),
    overHardMaxStops: Boolean(v2Profile.overHardMaxStops),
    dayMismatchWarnings: extractDayMismatchWarnings(v2Profile),
    penalties: Array.isArray(v2Score.penalties) ? v2Score.penalties : [],
    bonuses: Array.isArray(v2Score.bonuses) ? v2Score.bonuses : [],
  };
}

/**
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>|null|undefined} technicians
 * @param {object|null|undefined} scoringResult
 * @returns {RealRouteCandidateDiagnostic[]}
 */
export function buildRealRouteTopCandidates(technicians, scoringResult) {
  return resolveScoringTopMatches(scoringResult)
    .slice(0, TOP_CANDIDATE_LIMIT)
    .map((match, index) => buildRealRouteCandidateDiagnostic(match, index + 1, technicians));
}

/**
 * @param {ValidationRunResult} result
 * @param {{
 *   routeDate: string,
 *   technicians?: Array<{ routeId?: string|number, stops?: unknown[] }>,
 *   scoringResult?: object|null,
 * }} context
 * @returns {RealRouteValidationRunResult}
 */
export function enrichRealRouteValidationResult(result, context) {
  const technicians = context.technicians ?? [];
  const topCandidates = buildRealRouteTopCandidates(technicians, context.scoringResult);
  const topCandidate = topCandidates[0] ?? null;

  return {
    ...result,
    routeDate: context.routeDate,
    routeTechnicianCount: technicians.length,
    topTechStopCount: topCandidate?.stopCount ?? null,
    topTechOverPreferredMax: topCandidate?.overPreferredMaxStops ?? null,
    topTechOverHardMax: topCandidate?.overHardMaxStops ?? null,
    dayMismatchWarnings: topCandidate?.dayMismatchWarnings ?? [],
    topCandidates,
  };
}

/**
 * @param {RealRouteValidationRunResult} result
 * @returns {RealRouteValidationFailureSummary|null}
 */
export function buildRealRouteFailureSummary(result) {
  if (result.passed) return null;

  return {
    id: result.id,
    routeDate: result.routeDate,
    expectedTechName: result.expectedTechName,
    actualTopTechName: result.actualTopTechName,
    expectedRank: result.expectedRank,
    failureReason: result.failureReason,
    dispatcherReason: result.dispatcherReason,
    stopCount: result.topTechStopCount,
    overPreferredMax: result.topTechOverPreferredMax,
    overHardMax: result.topTechOverHardMax,
    dayMismatchWarnings: result.dayMismatchWarnings,
    topCandidates: result.topCandidates,
    topMatches: result.topMatches,
  };
}

/**
 * @param {RealRouteValidationRunResult[]} results
 * @returns {RealRouteValidationFailureSummary[]}
 */
export function collectRealRouteFailures(results = []) {
  return results
    .map(buildRealRouteFailureSummary)
    .filter(Boolean);
}
