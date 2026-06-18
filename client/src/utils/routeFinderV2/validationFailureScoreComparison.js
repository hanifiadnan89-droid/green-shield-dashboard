/**
 * Route Finder V2 — expected vs winning technician score comparison for calibration failures.
 * Reporting only; does not change scoring weights or logic.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';
import {
  buildLeadFromValidationExample,
  buildValidationTopMatchDiagnostic,
  resolveScoringTopMatches,
} from './validationRunner.js';
import { resolveProjectedStopCount } from './technicianEligibility.js';
import { enrichAllRankedMatchesForDiagnostics } from './profileScoringModifiers.js';
import { resolveLeadTown } from './profileScoringModifiers.js';
import { buildTechnicianTerritoryDiagnostic } from './territoryOwnership.js';

/**
 * @typedef {import('./validationExamples.js').RouteFinderValidationExample} RouteFinderValidationExample
 * @typedef {import('./validationCalibrationDiagnostics.js').RealRouteValidationFailureSummary} RealRouteValidationFailureSummary
 */

/**
 * @typedef {Object} LegacyBaseScoreBreakdown
 * @property {number} geographic
 * @property {number} travelEfficiency
 * @property {number} timeWindow
 * @property {number} workload
 * @property {number} serviceDuration
 * @property {number} capacity
 * @property {number} insertionProximity
 * @property {number} routeAreaBonus
 * @property {number} workloadPenalty
 * @property {number} total
 */

/**
 * @typedef {Object} TechnicianScoreSnapshot
 * @property {string} techName
 * @property {number} rank
 * @property {number} baseTotal
 * @property {number} adjustedTotal
 * @property {number} adjustment
 * @property {LegacyBaseScoreBreakdown} baseScoreBreakdown
 * @property {number} geoClusterBonus
 * @property {number} geoClusterPenalty
 * @property {number} sameTownBonus
 * @property {number} nearbyRouteBonus
 * @property {number} normalServiceAreaBonus
 * @property {number} territoryOwnerBonus
 * @property {number} neighboringTerritoryPenalty
 * @property {number} backtrackingPenalty
 * @property {number} stopLoadPenalty
 * @property {number} workloadPenalty
 * @property {number} stopCount
 * @property {string} eligibilityStatus
 * @property {Array<{ code: string, label: string, points: number }>} bonuses
 * @property {Array<{ code: string, label: string, points: number }>} penalties
 * @property {string} explanation
 */

/**
 * @typedef {Object} FailureScoreComparison
 * @property {string} exampleId
 * @property {string} routeDate
 * @property {string} expectedTechName
 * @property {string} winningTechName
 * @property {string} dispatcherConfidence
 * @property {string} failureClassification
 * @property {TechnicianScoreSnapshot|null} expected
 * @property {TechnicianScoreSnapshot|null} winner
 * @property {number|null} finalScoreDelta
 * @property {string} whyWinnerWon
 * @property {ReturnType<typeof buildTechnicianTerritoryDiagnostic>|null} expectedTerritory
 * @property {ReturnType<typeof buildTechnicianTerritoryDiagnostic>|null} winnerTerritory
 * @property {string[]} comparisonMatchPoolTechNames
 * @property {string} lookupNote
 */

const GEO_CLUSTER_BONUS_CODES = ['strong_geo_cluster'];
const GEO_CLUSTER_PENALTY_CODES = ['weak_geo_cluster'];
const SAME_TOWN_BONUS_CODES = ['same_town_match'];
const NEARBY_ROUTE_BONUS_CODES = ['nearby_route_stop_same_town', 'nearby_route_stop_same_region'];
const NORMAL_SERVICE_AREA_BONUS_CODES = ['normal_service_area_match'];
const TERRITORY_OWNER_BONUS_CODES = ['territory_owner_bonus'];
const NEIGHBORING_TERRITORY_PENALTY_CODES = ['neighboring_territory_penalty'];
const BACKTRACKING_PENALTY_CODES = ['backtracking_risk'];
const STOP_LOAD_PENALTY_CODES = ['over_preferred_max_stops', 'over_hard_max_stops'];

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
 * @param {Array<{ code: string, points: number }>} items
 * @param {string[]} codes
 * @returns {number}
 */
export function sumModifierPoints(items = [], codes = []) {
  return items
    .filter(item => codes.includes(item.code))
    .reduce((sum, item) => sum + Number(item.points ?? 0), 0);
}

/**
 * @param {object|null|undefined} match
 * @param {number} rank
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>|null|undefined} technicians
 * @returns {TechnicianScoreSnapshot}
 */
export function buildTechnicianScoreSnapshot(match, rank, technicians = []) {
  const diagnostic = buildValidationTopMatchDiagnostic(match, rank);
  const v2Score = match?.v2Score ?? {};
  const bonuses = Array.isArray(v2Score.bonuses) ? v2Score.bonuses : diagnostic.bonuses;
  const penalties = Array.isArray(v2Score.penalties) ? v2Score.penalties : diagnostic.penalties;
  const scores = match?.scores ?? {};

  return {
    techName: diagnostic.techName,
    rank,
    baseTotal: Number(v2Score.baseTotal ?? diagnostic.baseTotal ?? scores.total ?? 0),
    adjustedTotal: Number(v2Score.adjustedTotal ?? diagnostic.adjustedTotal ?? scores.total ?? 0),
    adjustment: Number(v2Score.adjustment ?? 0),
    baseScoreBreakdown: {
      geographic: Number(scores.geographic ?? 0),
      travelEfficiency: Number(scores.travelEfficiency ?? 0),
      timeWindow: Number(scores.timeWindow ?? 0),
      workload: Number(scores.workload ?? 0),
      serviceDuration: Number(scores.serviceDuration ?? 0),
      capacity: Number(scores.capacity ?? 0),
      insertionProximity: Number(scores.insertionProximity ?? 0),
      routeAreaBonus: Number(scores.routeAreaBonus ?? 0),
      workloadPenalty: Number(scores.workloadPenalty ?? 0),
      total: Number(scores.total ?? v2Score.baseTotal ?? 0),
    },
    geoClusterBonus: sumModifierPoints(bonuses, GEO_CLUSTER_BONUS_CODES),
    geoClusterPenalty: sumModifierPoints(penalties, GEO_CLUSTER_PENALTY_CODES),
    sameTownBonus: sumModifierPoints(bonuses, SAME_TOWN_BONUS_CODES),
    nearbyRouteBonus: sumModifierPoints(bonuses, NEARBY_ROUTE_BONUS_CODES),
    normalServiceAreaBonus: sumModifierPoints(bonuses, NORMAL_SERVICE_AREA_BONUS_CODES),
    territoryOwnerBonus: sumModifierPoints(bonuses, TERRITORY_OWNER_BONUS_CODES),
    neighboringTerritoryPenalty: sumModifierPoints(penalties, NEIGHBORING_TERRITORY_PENALTY_CODES),
    backtrackingPenalty: sumModifierPoints(penalties, BACKTRACKING_PENALTY_CODES),
    stopLoadPenalty: sumModifierPoints(penalties, STOP_LOAD_PENALTY_CODES),
    workloadPenalty: Number(scores.workloadPenalty ?? 0),
    stopCount: Math.max(0, resolveProjectedStopCount(match, technicians) - 1),
    eligibilityStatus: diagnostic.eligibilityStatus,
    bonuses,
    penalties,
    explanation: diagnostic.explanation || v2Score.explanation || '',
  };
}

/**
 * @param {TechnicianScoreSnapshot|null|undefined} expected
 * @param {TechnicianScoreSnapshot|null|undefined} winner
 * @returns {string}
 */
export function explainWhyWinnerBeatExpected(expected, winner) {
  if (!expected || !winner) {
    return 'Insufficient scoring data to compare expected and winning technicians.';
  }

  const deltas = [
    { label: 'base total', delta: winner.baseTotal - expected.baseTotal },
    { label: 'geo cluster bonus', delta: winner.geoClusterBonus - expected.geoClusterBonus },
    { label: 'geo cluster penalty', delta: expected.geoClusterPenalty - winner.geoClusterPenalty },
    { label: 'same town bonus', delta: winner.sameTownBonus - expected.sameTownBonus },
    { label: 'nearby route bonus', delta: winner.nearbyRouteBonus - expected.nearbyRouteBonus },
    { label: 'normal service area bonus', delta: winner.normalServiceAreaBonus - expected.normalServiceAreaBonus },
    { label: 'territory owner bonus', delta: winner.territoryOwnerBonus - expected.territoryOwnerBonus },
    { label: 'neighboring territory penalty', delta: expected.neighboringTerritoryPenalty - winner.neighboringTerritoryPenalty },
    { label: 'backtracking penalty', delta: expected.backtrackingPenalty - winner.backtrackingPenalty },
    { label: 'stop load penalty', delta: expected.stopLoadPenalty - winner.stopLoadPenalty },
    { label: 'workload penalty', delta: expected.workloadPenalty - winner.workloadPenalty },
    { label: 'adjusted total', delta: winner.adjustedTotal - expected.adjustedTotal },
  ].filter(item => item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  if (!deltas.length) {
    return 'Winner and expected technician have identical score components; rank order may reflect tie-break ordering.';
  }

  const topDrivers = deltas.slice(0, 4).map(item => `${item.label} ${item.delta > 0 ? '+' : ''}${item.delta}`);
  return `Winner leads on: ${topDrivers.join('; ')}.`;
}

/**
 * @param {object|null|undefined} scoringResult
 * @returns {object[]}
 */
export function resolveScoringMatchPool(scoringResult) {
  if (!scoringResult) return [];
  if (Array.isArray(scoringResult.comparisonMatchPool)) {
    return scoringResult.comparisonMatchPool;
  }
  if (Array.isArray(scoringResult.allRankedMatches)) {
    return scoringResult.allRankedMatches;
  }
  return resolveScoringTopMatches(scoringResult);
}

/**
 * @param {object|null|undefined} scoringResult
 * @param {string} techName
 * @returns {object|null}
 */
export function findMatchInScoringPool(scoringResult, techName) {
  return resolveScoringMatchPool(scoringResult).find(
    match => techNamesEquivalent(match?.techName, techName),
  ) ?? null;
}

/**
 * @param {object|null|undefined} scoringResult
 * @param {string} techName
 * @returns {boolean}
 */
export function isTechnicianInTopMatches(scoringResult, techName) {
  return resolveScoringTopMatches(scoringResult).some(
    match => techNamesEquivalent(match?.techName, techName),
  );
}

/**
 * @param {object|null|undefined} scoringResult
 * @param {string} techName
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>|null|undefined} technicians
 * @returns {TechnicianScoreSnapshot|null}
 */
export function findTechnicianScoreSnapshot(scoringResult, techName, technicians = []) {
  const pool = resolveScoringMatchPool(scoringResult);
  const match = findMatchInScoringPool(scoringResult, techName);
  if (!match) return null;

  const ranked = [...pool].sort((left, right) => (
    (right?.v2Score?.adjustedTotal ?? right?.scores?.total ?? 0)
    - (left?.v2Score?.adjustedTotal ?? left?.scores?.total ?? 0)
  ));
  const index = ranked.findIndex(row => techNamesEquivalent(row?.techName, techName));
  return buildTechnicianScoreSnapshot(match, index + 1, technicians);
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {string} techName
 * @param {object|null|undefined} scoringResult
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>} technicians
 * @returns {ReturnType<typeof buildTechnicianTerritoryDiagnostic>}
 */
export function buildComparisonTerritoryDiagnostic(
  example,
  techName,
  scoringResult,
  technicians,
) {
  const lead = buildLeadFromValidationExample(example);
  const leadTown = resolveLeadTown(lead);
  const match = findMatchInScoringPool(scoringResult, techName);

  return buildTechnicianTerritoryDiagnostic({
    techName,
    match,
    leadTown,
    technicians,
    inTopMatches: isTechnicianInTopMatches(scoringResult, techName),
  });
}

/**
 * @param {object|null|undefined} scoringResult
 * @returns {string}
 */
function describeComparisonLookupNote(scoringResult) {
  if (!scoringResult) return 'No scoring result available.';
  if (Array.isArray(scoringResult.comparisonMatchPool)) {
    return 'Compared using full ranked match pool with diagnostic territory enrichment.';
  }
  if (Array.isArray(scoringResult.allRankedMatches)) {
    return 'Compared using allRankedMatches (area-viability filter may exclude technicians from topMatches).';
  }
  return 'Compared using topMatches only; technicians outside top N may be missing.';
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {RealRouteValidationFailureSummary & {
 *   dispatcherConfidence?: string,
 *   failureClassification?: string,
 * }} failure
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>} technicians
 * @param {object|null|undefined} scoringResult
 * @returns {FailureScoreComparison}
 */
export function buildFailureScoreComparison(example, failure, technicians, scoringResult) {
  const winningTechName = failure.actualTopTechName ?? '—';
  const expected = findTechnicianScoreSnapshot(scoringResult, failure.expectedTechName, technicians);
  const winner = findTechnicianScoreSnapshot(scoringResult, winningTechName, technicians);
  const finalScoreDelta = expected && winner
    ? winner.adjustedTotal - expected.adjustedTotal
    : null;

  return {
    exampleId: failure.id,
    routeDate: failure.routeDate,
    expectedTechName: failure.expectedTechName,
    winningTechName,
    dispatcherConfidence: failure.dispatcherConfidence ?? '—',
    failureClassification: failure.failureClassification ?? '—',
    expected,
    winner,
    finalScoreDelta,
    whyWinnerWon: explainWhyWinnerBeatExpected(expected, winner),
    expectedTerritory: buildComparisonTerritoryDiagnostic(
      example,
      failure.expectedTechName,
      scoringResult,
      technicians,
    ),
    winnerTerritory: buildComparisonTerritoryDiagnostic(
      example,
      winningTechName,
      scoringResult,
      technicians,
    ),
    comparisonMatchPoolTechNames: resolveScoringMatchPool(scoringResult).map(match => match.techName),
    lookupNote: describeComparisonLookupNote(scoringResult),
  };
}

/**
 * Compare dispatcher-confirmed expected vs winning technicians directly.
 *
 * @param {RouteFinderValidationExample} example
 * @param {string} winningTechName
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>} technicians
 * @param {object|null|undefined} scoringResult
 * @param {string} routeDate
 * @returns {FailureScoreComparison}
 */
export function buildExplicitScoreComparison(
  example,
  winningTechName,
  technicians,
  scoringResult,
  routeDate,
) {
  const expected = findTechnicianScoreSnapshot(scoringResult, example.expectedTechName, technicians);
  const winner = findTechnicianScoreSnapshot(scoringResult, winningTechName, technicians);
  const finalScoreDelta = expected && winner
    ? winner.adjustedTotal - expected.adjustedTotal
    : null;

  return {
    exampleId: example.id,
    routeDate,
    expectedTechName: example.expectedTechName,
    winningTechName,
    dispatcherConfidence: 'high',
    failureClassification: 'true_routing_mistake',
    expected,
    winner,
    finalScoreDelta,
    whyWinnerWon: explainWhyWinnerBeatExpected(expected, winner),
    expectedTerritory: buildComparisonTerritoryDiagnostic(
      example,
      example.expectedTechName,
      scoringResult,
      technicians,
    ),
    winnerTerritory: buildComparisonTerritoryDiagnostic(
      example,
      winningTechName,
      scoringResult,
      technicians,
    ),
    comparisonMatchPoolTechNames: resolveScoringMatchPool(scoringResult).map(match => match.techName),
    lookupNote: describeComparisonLookupNote(scoringResult),
  };
}

/**
 * @param {Array<RealRouteValidationFailureSummary & {
 *   dispatcherConfidence?: string,
 *   failureClassification?: string,
 * }>} failures
 * @param {import('./validationExamples.js').RouteFinderValidationExample[]} examples
 * @param {Record<string, Array<{ routeId?: string|number, stops?: unknown[] }>>} techniciansByExampleId
 * @param {Record<string, object|null|undefined>} scoringByExampleId
 * @returns {FailureScoreComparison[]}
 */
export function buildHighConfidenceFailureComparisons(
  failures = [],
  examples = [],
  techniciansByExampleId = {},
  scoringByExampleId = {},
) {
  const exampleById = new Map(examples.map(example => [example.id, example]));

  return failures
    .filter(failure => failure.dispatcherConfidence === 'high')
    .map((failure) => {
      const example = exampleById.get(failure.id);
      if (!example) return null;
      return buildFailureScoreComparison(
        example,
        failure,
        techniciansByExampleId[failure.id] ?? [],
        scoringByExampleId[failure.id],
      );
    })
    .filter(Boolean);
}

/**
 * @param {LegacyBaseScoreBreakdown} breakdown
 * @returns {string}
 */
function formatBaseBreakdown(breakdown) {
  return [
    `geo ${breakdown.geographic}`,
    `travel ${breakdown.travelEfficiency}`,
    `window ${breakdown.timeWindow}`,
    `workload ${breakdown.workload}`,
    `svcDur ${breakdown.serviceDuration}`,
    `cap ${breakdown.capacity}`,
    `insProx ${breakdown.insertionProximity}`,
    `areaBonus ${breakdown.routeAreaBonus}`,
    `loadPen ${breakdown.workloadPenalty}`,
  ].join(' | ');
}

/**
 * @param {TechnicianScoreSnapshot|null|undefined} snapshot
 * @returns {string}
 */
function formatAdjustedBreakdown(snapshot) {
  if (!snapshot) return '—';
  const bonusText = snapshot.bonuses.length
    ? snapshot.bonuses.map(item => `${item.code} +${item.points}`).join(', ')
    : 'none';
  const penaltyText = snapshot.penalties.length
    ? snapshot.penalties.map(item => `${item.code} -${item.points}`).join(', ')
    : 'none';
  return `bonuses: ${bonusText}; penalties: ${penaltyText}`;
}

function formatTerritoryDiagnostic(label, diagnostic) {
  if (!diagnostic) return `${label}: —`;
  return [
    `${label}:`,
    `scheduled=${diagnostic.scheduled}`,
    `scored=${diagnostic.scored}`,
    `inTopMatches=${diagnostic.inTopMatches}`,
    `corridorOwnerAvailable=${diagnostic.corridorOwnerAvailable}`,
    `territoryOwnerBonus=${diagnostic.territoryOwnerBonusApplied}`,
    `neighboringTerritoryPenalty=${diagnostic.neighboringTerritoryPenaltyApplied}`,
    `unavailability=${diagnostic.unavailabilityReasons.join(', ') || 'none'}`,
  ].join(' ');
}

/**
 * True when the printed comparison lines would show both territories as
 * scheduled=false with unavailability=not_scheduled.
 *
 * @param {FailureScoreComparison|null|undefined} comparison
 * @returns {boolean}
 */
export function comparisonDiagnosticsIndicateCorridorOwnerNotScheduled(comparison) {
  const expected = comparison?.expectedTerritory;
  const winner = comparison?.winnerTerritory;
  if (!expected || !winner) return false;
  if (expected.scheduled !== false || winner.scheduled !== false) return false;

  const expectedUnavailability = expected.unavailabilityReasons ?? [];
  const winnerUnavailability = winner.unavailabilityReasons ?? [];
  return expectedUnavailability.includes('not_scheduled')
    && winnerUnavailability.includes('not_scheduled');
}

/**
 * @param {FailureScoreComparison[]} comparisons
 * @returns {string}
 */
export function formatFailureScoreComparisonTable(comparisons = []) {
  const lines = [
    'High-confidence failure score comparisons',
    '========================================',
    '',
  ];

  if (!comparisons.length) {
    lines.push('No high-confidence failures to compare.');
    return lines.join('\n');
  }

  for (const [index, row] of comparisons.entries()) {
    lines.push(`${index + 1}. ${row.exampleId} (${row.routeDate})`);
    lines.push(`   expected technician: ${row.expectedTechName}`);
    lines.push(`   winning technician: ${row.winningTechName}`);
    lines.push(`   final score delta (winner - expected): ${row.finalScoreDelta ?? '—'}`);
    lines.push(`   why winner won: ${row.whyWinnerWon}`);
    lines.push(`   lookup: ${row.lookupNote ?? '—'}`);
    lines.push(`   ${formatTerritoryDiagnostic('expected territory', row.expectedTerritory)}`);
    lines.push(`   ${formatTerritoryDiagnostic('winner territory', row.winnerTerritory)}`);
    lines.push('');
    lines.push('   | metric | expected | winner | delta (winner - expected) |');
    lines.push('   | --- | ---: | ---: | ---: |');

    const metrics = [
      ['base total', row.expected?.baseTotal, row.winner?.baseTotal],
      ['adjusted total', row.expected?.adjustedTotal, row.winner?.adjustedTotal],
      ['geo cluster bonus', row.expected?.geoClusterBonus, row.winner?.geoClusterBonus],
      ['geo cluster penalty', row.expected?.geoClusterPenalty, row.winner?.geoClusterPenalty],
      ['same town bonus', row.expected?.sameTownBonus, row.winner?.sameTownBonus],
      ['nearby route bonus', row.expected?.nearbyRouteBonus, row.winner?.nearbyRouteBonus],
      ['normal service area bonus', row.expected?.normalServiceAreaBonus, row.winner?.normalServiceAreaBonus],
      ['territory owner bonus', row.expected?.territoryOwnerBonus, row.winner?.territoryOwnerBonus],
      ['neighboring territory penalty', row.expected?.neighboringTerritoryPenalty, row.winner?.neighboringTerritoryPenalty],
      ['backtracking penalty', row.expected?.backtrackingPenalty, row.winner?.backtrackingPenalty],
      ['stop load penalty', row.expected?.stopLoadPenalty, row.winner?.stopLoadPenalty],
      ['workload penalty (base)', row.expected?.workloadPenalty, row.winner?.workloadPenalty],
      ['stop count', row.expected?.stopCount, row.winner?.stopCount],
      ['V2 rank', row.expected?.rank, row.winner?.rank],
    ];

    for (const [label, expectedValue, winnerValue] of metrics) {
      const expectedNumber = Number(expectedValue ?? 0);
      const winnerNumber = Number(winnerValue ?? 0);
      const delta = winnerNumber - expectedNumber;
      lines.push(`   | ${label} | ${expectedValue ?? '—'} | ${winnerValue ?? '—'} | ${delta > 0 ? '+' : ''}${delta} |`);
    }

    lines.push('');
    lines.push(`   expected base breakdown: ${row.expected ? formatBaseBreakdown(row.expected.baseScoreBreakdown) : '—'}`);
    lines.push(`   winner base breakdown: ${row.winner ? formatBaseBreakdown(row.winner.baseScoreBreakdown) : '—'}`);
    lines.push(`   expected adjusted breakdown: ${formatAdjustedBreakdown(row.expected)}`);
    lines.push(`   winner adjusted breakdown: ${formatAdjustedBreakdown(row.winner)}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * @param {Array<RealRouteValidationFailureSummary & {
 *   dispatcherConfidence?: string,
 *   failureClassification?: string,
 * }>} failures
 * @param {import('./validationExamples.js').RouteFinderValidationExample[]} examples
 * @param {Record<string, Array<{ routeId?: string|number, stops?: unknown[] }>>} techniciansByExampleId
 * @param {Record<string, object|null|undefined>} scoringByExampleId
 * @returns {string}
 */
export function formatHighConfidenceFailureComparisonReport(
  failures,
  examples,
  techniciansByExampleId,
  scoringByExampleId,
) {
  const comparisons = buildHighConfidenceFailureComparisons(
    failures,
    examples,
    techniciansByExampleId,
    scoringByExampleId,
  );
  return formatFailureScoreComparisonTable(comparisons);
}

/**
 * Re-score with full technician list so expected tech is present in top matches.
 *
 * @param {RouteFinderValidationExample} example
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>} technicians
 * @param {(example: RouteFinderValidationExample, lead: object, technicians: Array<object>, topN: number) => Promise<object>} scoreExample
 * @returns {Promise<object|null|undefined>}
 */
export async function scoreExampleForFailureComparison(example, technicians, scoreExample) {
  const lead = buildLeadFromValidationExample(example);
  const topN = Math.max(technicians.length, 3);
  const scoringResult = await scoreExample(example, lead, technicians, topN);
  return enrichAllRankedMatchesForDiagnostics(scoringResult, lead, technicians);
}
