/**
 * Route Finder V2 — dispatcher validation harness.
 * Compares V2 scoring output against approved examples for calibration/diagnostics.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';
import { inferRouteAreaFromAddress, resolveAcceptedRankMax } from './validationExamples.js';

/**
 * @typedef {import('./validationExamples.js').RouteFinderValidationExample} RouteFinderValidationExample
 */

/**
 * @typedef {Object} ValidationTopMatchDiagnostic
 * @property {number} rank
 * @property {string} techName
 * @property {number} baseTotal
 * @property {number} adjustedTotal
 * @property {string} eligibilityStatus
 * @property {Array<{ code: string, label: string, points: number }>} penalties
 * @property {Array<{ code: string, label: string, points: number }>} bonuses
 * @property {string} explanation
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} ValidationRunResult
 * @property {string} id
 * @property {boolean} passed
 * @property {string} expectedTechName
 * @property {string|null} actualTopTechName
 * @property {number|null} expectedRank
 * @property {number} acceptedRankMax
 * @property {ValidationTopMatchDiagnostic[]} topMatches
 * @property {string|null} failureReason
 * @property {string} dispatcherReason
 * @property {string} notes
 * @property {string[]|undefined} reasonTags
 * @property {number} technicianCount
 */

/**
 * @typedef {Object} ValidationFailureSummary
 * @property {string} id
 * @property {string} expectedTechName
 * @property {string|null} actualTopTechName
 * @property {number|null} expectedRank
 * @property {string|null} failureReason
 * @property {string} dispatcherReason
 * @property {ValidationTopMatchDiagnostic[]} topMatches
 */

/**
 * @typedef {Object} ValidationSummary
 * @property {number} totalExamples
 * @property {number} passed
 * @property {number} failed
 * @property {number} passRate
 * @property {ValidationFailureSummary[]} failures
 */

const TOP_MATCH_LIMIT = 3;

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

function techNameInList(techName, names = []) {
  return names.some(name => techNamesEquivalent(techName, name));
}

/**
 * @param {object|null|undefined} scoringResult
 * @returns {object[]}
 */
export function resolveScoringTopMatches(scoringResult) {
  if (!scoringResult) return [];
  if (Array.isArray(scoringResult.topMatches)) return scoringResult.topMatches;
  if (Array.isArray(scoringResult.result?.topMatches)) return scoringResult.result.topMatches;
  return [];
}

/**
 * @param {object} match
 * @param {number} rank
 * @returns {ValidationTopMatchDiagnostic}
 */
export function buildValidationTopMatchDiagnostic(match, rank) {
  const v2Score = match?.v2Score ?? {};
  const v2Profile = match?.v2Profile ?? {};

  return {
    rank,
    techName: match?.techName ?? 'Unknown',
    baseTotal: Number(v2Score.baseTotal ?? match?.scores?.total ?? 0),
    adjustedTotal: Number(v2Score.adjustedTotal ?? match?.scores?.total ?? 0),
    eligibilityStatus: v2Profile.eligibilityStatus ?? 'unknown',
    penalties: Array.isArray(v2Score.penalties) ? v2Score.penalties : [],
    bonuses: Array.isArray(v2Score.bonuses) ? v2Score.bonuses : [],
    explanation: typeof v2Score.explanation === 'string' ? v2Score.explanation : '',
    warnings: Array.isArray(v2Profile.warnings) ? v2Profile.warnings : [],
  };
}

/**
 * @param {RouteFinderValidationExample} example
 * @returns {string[]}
 */
export function resolveAcceptableTechNames(example) {
  if (Array.isArray(example.acceptableTechNames) && example.acceptableTechNames.length > 0) {
    return example.acceptableTechNames;
  }
  return [example.expectedTechName];
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {Array<{ techName?: string }>|null|undefined} technicians
 * @param {object|null|undefined} scoringResult
 * @returns {ValidationRunResult}
 */
export function evaluateValidationExample(example, technicians, scoringResult) {
  const acceptedRankMax = resolveAcceptedRankMax(example);
  const acceptableTechNames = resolveAcceptableTechNames(example);
  const forbiddenTechNames = example.expectedNotTechNames ?? [];
  const topMatchesRaw = resolveScoringTopMatches(scoringResult).slice(0, TOP_MATCH_LIMIT);

  const topMatches = topMatchesRaw.map((match, index) => (
    buildValidationTopMatchDiagnostic(match, index + 1)
  ));

  const actualTopTechName = topMatches[0]?.techName ?? null;

  let expectedRank = null;
  for (const match of topMatches) {
    if (techNameInList(match.techName, acceptableTechNames)) {
      expectedRank = match.rank;
      break;
    }
  }

  let passed = true;
  let failureReason = null;

  if (!topMatches.length) {
    passed = false;
    failureReason = 'No top matches returned from V2 scoring';
  } else if (actualTopTechName && techNameInList(actualTopTechName, forbiddenTechNames)) {
    passed = false;
    failureReason = `Forbidden technician ranked #1: ${actualTopTechName}`;
  } else if (expectedRank == null) {
    passed = false;
    failureReason = `Expected technician not found in top ${TOP_MATCH_LIMIT}: ${
      acceptableTechNames.join(', ')
    }`;
  } else if (expectedRank > acceptedRankMax) {
    passed = false;
    failureReason = `Expected technician ranked #${expectedRank}, but acceptedRankMax is ${acceptedRankMax}`;
  }

  return {
    id: example.id,
    passed,
    expectedTechName: example.expectedTechName,
    actualTopTechName,
    expectedRank,
    acceptedRankMax,
    topMatches,
    failureReason,
    dispatcherReason: example.dispatcherReason,
    notes: example.notes,
    reasonTags: example.reasonTags,
    technicianCount: technicians?.length ?? 0,
  };
}

/**
 * @param {string|null|undefined} timePreference
 * @returns {string}
 */
export function mapValidationTimePreference(timePreference) {
  const prefRaw = String(timePreference ?? 'Anytime').trim();
  const upper = prefRaw.toUpperCase();
  if (upper === 'ANYTIME' || upper === 'AT') return 'AT';
  if (upper === 'AM' || upper === 'PM') return upper;
  return prefRaw;
}

/**
 * @param {RouteFinderValidationExample} example
 * @returns {object}
 */
export function buildLeadFromValidationExample(example) {
  const { newJob } = example;
  const timeWindowPreference = mapValidationTimePreference(newJob.timePreference);
  const routeArea = newJob.routeArea ?? inferRouteAreaFromAddress(newJob.address);

  return {
    lat: newJob.lat,
    lng: newJob.lng,
    address: newJob.address,
    serviceType: newJob.serviceType,
    serviceAbbreviation: newJob.serviceType,
    serviceLabel: newJob.serviceType,
    timeWindowPreference,
    routeArea,
    date: example.date,
    durationMinutes: newJob.durationMinutes ?? 30,
    customerMustBeHome: Boolean(newJob.customerMustBeHome),
    sameDayUrgent: Boolean(newJob.sameDayUrgent),
    exteriorOnly: Boolean(newJob.exteriorOnly),
    isPaidInitial: Boolean(newJob.isPaidInitial),
    isReservice: Boolean(newJob.isReservice),
    isCommercial: Boolean(newJob.isCommercial),
    callAheadRequired: Boolean(newJob.customerMustBeHome),
  };
}

/**
 * DEV-only console helper for validation diagnostics.
 * @param {ValidationRunResult} result
 */
export function printValidationResult(result) {
  if (!import.meta.env.DEV) return;

  const status = result.passed ? 'PASS' : 'FAIL';
  console.debug(`[RouteFinder V2 Validation] ${status} ${result.id}`, {
    expectedTechName: result.expectedTechName,
    actualTopTechName: result.actualTopTechName,
    expectedRank: result.expectedRank,
    acceptedRankMax: result.acceptedRankMax,
    failureReason: result.failureReason,
    dispatcherReason: result.dispatcherReason,
    notes: result.notes,
    reasonTags: result.reasonTags,
    technicianCount: result.technicianCount,
    topMatches: result.topMatches,
  });
}

/**
 * @param {RouteFinderValidationExample[]} examples
 * @param {Array<{ techName?: string }>|null|undefined} technicians
 * @param {object|null|undefined} scoringResult
 * @returns {ValidationRunResult[]}
 */
export function evaluateValidationExamples(examples, technicians, scoringResult) {
  return examples.map(example => evaluateValidationExample(example, technicians, scoringResult));
}

/**
 * @param {ValidationRunResult[]} results
 * @returns {number}
 */
export function getValidationPassRate(results = []) {
  if (!results.length) return 0;
  const passed = results.filter(result => result.passed).length;
  return passed / results.length;
}

/**
 * @param {ValidationRunResult[]} results
 * @returns {ValidationSummary}
 */
export function summarizeValidationResults(results = []) {
  const passed = results.filter(result => result.passed).length;
  const failed = results.length - passed;

  return {
    totalExamples: results.length,
    passed,
    failed,
    passRate: getValidationPassRate(results),
    failures: results
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
 * DEV-only summary printer for validation report batches.
 * @param {ValidationRunResult[]|ValidationSummary} resultsOrSummary
 */
export function printValidationSummary(resultsOrSummary) {
  if (!import.meta.env.DEV) return;

  const summary = Array.isArray(resultsOrSummary)
    ? summarizeValidationResults(resultsOrSummary)
    : resultsOrSummary;

  console.debug('[RouteFinder V2 Validation] summary', {
    totalExamples: summary.totalExamples,
    passed: summary.passed,
    failed: summary.failed,
    passRate: summary.passRate,
    failures: summary.failures,
  });
}
