/**
 * Route Finder V2 — dispatcher validation harness.
 * Compares V2 scoring output against approved examples for calibration/diagnostics.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';

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
  const acceptedRankMax = example.acceptedRankMax ?? 1;
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
 * @param {RouteFinderValidationExample} example
 * @returns {object}
 */
export function buildLeadFromValidationExample(example) {
  const prefRaw = String(example.newJob.timePreference ?? 'Anytime').trim().toUpperCase();
  const timeWindowPreference = prefRaw === 'ANYTIME' || prefRaw === 'AT' ? 'AT'
    : prefRaw === 'AM' ? 'AM'
      : prefRaw === 'PM' ? 'PM'
        : 'AT';

  return {
    lat: example.newJob.lat,
    lng: example.newJob.lng,
    address: example.newJob.address,
    serviceType: example.newJob.serviceType,
    serviceAbbreviation: example.newJob.serviceType,
    serviceLabel: example.newJob.serviceType,
    timeWindowPreference,
    routeArea: example.newJob.routeArea ?? 'maine',
    date: example.date,
    durationMinutes: example.newJob.durationMinutes ?? 30,
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
