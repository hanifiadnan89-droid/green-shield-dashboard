/**
 * Route Finder V2 — grouped failure pattern analysis for real-route calibration.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';
import { resolveLeadServiceTypeKey } from './serviceDurations.js';
import {
  resolveAcceptableTechNames,
  resolveScoringTopMatches,
} from './validationRunner.js';
import { extractDayMismatchWarnings } from './validationCalibrationDiagnostics.js';
import { inferRouteAreaFromAddress } from './validationExamples.js';
import {
  classifyDispatcherConfidence,
  summarizeDispatcherConfidence,
} from './dispatcherConfidenceClassification.js';

/**
 * @typedef {import('./validationExamples.js').RouteFinderValidationExample} RouteFinderValidationExample
 * @typedef {import('./validationCalibrationDiagnostics.js').RealRouteValidationFailureSummary} RealRouteValidationFailureSummary
 * @typedef {import('./validationCalibrationDiagnostics.js').RealRouteValidationRunResult} RealRouteValidationRunResult
 */

/** @typedef {ValidationFailurePatternKey} ValidationFailurePatternKey */

/**
 * @typedef {'expected_tech_route_not_present'
 *   | 'expected_tech_over_preferred_max'
 *   | 'expected_tech_over_hard_max'
 *   | 'wrong_region_beating_correct_region'
 *   | 'nh_day_mismatch'
 *   | 'service_capability_issue'
 *   | 'no_top_matches'
 *   | 'other_scoring_miss'} ValidationFailurePatternKey
 */

/**
 * @typedef {Object} ValidationFailurePatternGroup
 * @property {ValidationFailurePatternKey} key
 * @property {string} label
 * @property {number} count
 * @property {string[]} exampleIds
 */

/**
 * @typedef {Object} ValidationFailurePatternReport
 * @property {ValidationFailurePatternGroup[]} groups
 * @property {Record<string, ValidationFailurePatternKey[]>} patternsByExampleId
 * @property {Array<RealRouteValidationFailureSummary & {
 *   patterns: ValidationFailurePatternKey[],
 *   priorityScore: number,
 *   failureClassification: import('./dispatcherConfidenceClassification.js').FailureClassification,
 *   dispatcherConfidence: import('./dispatcherConfidenceClassification.js').DispatcherConfidence,
 *   classificationReason: string,
 * }>} prioritizedFailures
 * @property {ReturnType<typeof summarizeDispatcherConfidence>} confidenceSummary
 */

export const VALIDATION_FAILURE_PATTERN_LABELS = {
  expected_tech_over_preferred_max: 'Expected tech over preferred max',
  expected_tech_over_hard_max: 'Expected tech over hard max',
  wrong_region_beating_correct_region: 'Wrong region beating correct region',
  nh_day_mismatch: 'NH day mismatch',
  service_capability_issue: 'Service capability issue',
  no_top_matches: 'No top matches',
  other_scoring_miss: 'True scoring miss',
};

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
 * @param {Array<{ techName?: string, stops?: unknown[] }>|null|undefined} technicians
 * @param {string} techName
 * @returns {{ tech: object|null, stopCount: number, profile: import('./technicianProfiles.js').TechnicianProfile|null }}
 */
function resolveTechRouteContext(technicians, techName) {
  const tech = technicians?.find(row => techNamesEquivalent(row?.techName, techName)) ?? null;
  const profile = matchTechnicianProfile(techName);
  const stopCount = tech?.stops?.length ?? 0;
  return { tech, stopCount, profile };
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {string} techName
 * @returns {boolean}
 */
function isServiceCapabilityIssueForTech(example, techName) {
  const profile = matchTechnicianProfile(techName);
  if (!profile) return false;

  const serviceTypeKey = resolveLeadServiceTypeKey({
    serviceType: example.newJob.serviceType,
    serviceAbbreviation: example.newJob.serviceType,
  });

  if (profile.cannotDoServices.includes(serviceTypeKey)) return true;
  if (serviceTypeKey !== 'GENERAL' && !profile.canDoServices.includes(serviceTypeKey)) return true;
  return false;
}

/**
 * @param {object|null|undefined} scoringResult
 * @param {string[]} acceptableTechNames
 * @returns {boolean}
 */
function hasServiceCapabilityIssueInTopMatches(scoringResult, acceptableTechNames) {
  for (const match of resolveScoringTopMatches(scoringResult)) {
    if (!techNameInList(match?.techName, acceptableTechNames)) continue;
    const warnings = match?.v2Profile?.warnings ?? [];
    if (match?.v2Profile?.eligibilityStatus === 'disqualified') {
      if (warnings.some(w => /service|capability|not eligible/i.test(String(w)))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {RealRouteValidationFailureSummary} failure
 * @param {Array<{ techName?: string, stops?: unknown[] }>|null|undefined} technicians
 * @param {object|null|undefined} scoringResult
 * @returns {ValidationFailurePatternKey[]}
 */
export function classifyRealRouteFailurePatterns(example, failure, technicians, scoringResult) {
  const patterns = [];
  const acceptableTechNames = resolveAcceptableTechNames(example);
  const expectedOnRoute = acceptableTechNames.some(
    name => resolveTechRouteContext(technicians, name).tech != null,
  );

  if (!technicians?.length || failure.failureReason?.includes('No top matches')) {
    patterns.push('no_top_matches');
  }

  for (const techName of acceptableTechNames) {
    const { stopCount, profile } = resolveTechRouteContext(technicians, techName);
    if (!profile || !resolveTechRouteContext(technicians, techName).tech) continue;
    if (stopCount > profile.preferredMaxStops) {
      patterns.push('expected_tech_over_preferred_max');
    }
    if (stopCount > profile.hardMaxStops) {
      patterns.push('expected_tech_over_hard_max');
    }
    if (isServiceCapabilityIssueForTech(example, techName)) {
      patterns.push('service_capability_issue');
    }
  }

  const nhLead = inferRouteAreaFromAddress(example.newJob.address) === 'new_hampshire'
    || example.newJob.routeArea === 'new_hampshire';

  const nhWarnings = [
    ...(failure.dayMismatchWarnings ?? []),
    ...(failure.topCandidates ?? []).flatMap(candidate => candidate.dayMismatchWarnings ?? []),
  ];

  for (const match of resolveScoringTopMatches(scoringResult)) {
    if (techNameInList(match?.techName, acceptableTechNames)) {
      nhWarnings.push(...extractDayMismatchWarnings(match?.v2Profile));
    }
  }

  if (nhLead && [...new Set(nhWarnings)].length > 0) {
    patterns.push('nh_day_mismatch');
  }

  if (hasServiceCapabilityIssueInTopMatches(scoringResult, acceptableTechNames)) {
    patterns.push('service_capability_issue');
  }

  if (
    expectedOnRoute
    && failure.actualTopTechName
    && !techNameInList(failure.actualTopTechName, acceptableTechNames)
    && !patterns.includes('no_top_matches')
  ) {
    patterns.push('wrong_region_beating_correct_region');
  }

  if (!patterns.length) {
    patterns.push('other_scoring_miss');
  }

  return [...new Set(patterns)];
}

/**
 * @param {ValidationFailurePatternKey[]} patterns
 * @param {RealRouteValidationFailureSummary} failure
 * @returns {number}
 */
export function scoreFailurePriority(patterns, failure) {
  const weights = {
    no_top_matches: 100,
    service_capability_issue: 90,
    expected_tech_over_hard_max: 85,
    nh_day_mismatch: 80,
    expected_tech_over_preferred_max: 70,
    wrong_region_beating_correct_region: 65,
    other_scoring_miss: 50,
  };

  let score = patterns.reduce((sum, key) => sum + (weights[key] ?? 40), 0);
  if (failure.expectedRank == null) score += 10;
  if (failure.expectedRank != null && failure.expectedRank > 1) score += 5;
  return score;
}

/**
 * @param {{
 *   examples: RouteFinderValidationExample[],
 *   results: RealRouteValidationRunResult[],
 *   techniciansByExampleId?: Record<string, Array<{ techName?: string, stops?: unknown[] }>>,
 *   scoringByExampleId?: Record<string, object|null|undefined>,
 * }} input
 * @returns {ValidationFailurePatternReport}
 */
export function buildValidationFailurePatternReport(input) {
  const exampleById = new Map(input.examples.map(example => [example.id, example]));
  const failures = input.results
    .filter(result => !result.passed)
    .map(result => buildRealRouteFailureSummaryFromResult(result))
    .filter(Boolean);

  const patternsByExampleId = {};
  const prioritizedFailures = [];

  for (const result of input.results.filter(row => row.applicable && !row.passed)) {
    const example = exampleById.get(result.id);
    if (!example) continue;

    const failure = buildRealRouteFailureSummaryFromResult(result);
    if (!failure) continue;

    const technicians = input.techniciansByExampleId?.[result.id] ?? [];
    const scoringResult = input.scoringByExampleId?.[result.id];
    const patterns = classifyRealRouteFailurePatterns(example, failure, technicians, scoringResult);
    const confidence = classifyDispatcherConfidence(
      example,
      failure,
      technicians,
      scoringResult,
      patterns,
    );
    patternsByExampleId[result.id] = patterns;
    prioritizedFailures.push({
      ...failure,
      patterns,
      priorityScore: scoreFailurePriority(patterns, failure),
      failureClassification: confidence.failureClassification,
      dispatcherConfidence: confidence.dispatcherConfidence,
      classificationReason: confidence.classificationReason,
    });
  }

  prioritizedFailures.sort((a, b) => b.priorityScore - a.priorityScore);

  const groupCounts = new Map();
  for (const failure of prioritizedFailures) {
    for (const pattern of failure.patterns) {
      if (!groupCounts.has(pattern)) {
        groupCounts.set(pattern, { count: 0, exampleIds: [] });
      }
      const group = groupCounts.get(pattern);
      group.count += 1;
      group.exampleIds.push(failure.id);
    }
  }

  const groups = Object.keys(VALIDATION_FAILURE_PATTERN_LABELS).map(key => ({
    key,
    label: VALIDATION_FAILURE_PATTERN_LABELS[key],
    count: groupCounts.get(key)?.count ?? 0,
    exampleIds: groupCounts.get(key)?.exampleIds ?? [],
  })).filter(group => group.count > 0);

  return {
    groups,
    patternsByExampleId,
    prioritizedFailures,
    confidenceSummary: summarizeDispatcherConfidence(prioritizedFailures),
  };
}

/**
 * @param {RealRouteValidationRunResult} result
 * @returns {RealRouteValidationFailureSummary|null}
 */
function buildRealRouteFailureSummaryFromResult(result) {
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
 * @param {ValidationFailurePatternReport} patternReport
 * @param {{
 *   routeDate: string|null,
 *   fixturePassRate: number,
 *   realRoutePassRate: number,
 *   realRouteApplicableCount?: number,
 *   realRouteSkippedCount?: number,
 *   totalRealRouteFailures: number,
 * }} summary
 * @returns {string}
 */
export function formatValidationFailurePatternReport(patternReport, summary) {
  const lines = [
    'Route Finder V2 — Real-Route Failure Pattern Report',
    '===================================================',
    `Route date: ${summary.routeDate ?? 'per-example'}`,
    `fixturePassRate: ${(summary.fixturePassRate * 100).toFixed(1)}%`,
    `realRoutePassRate: ${(summary.realRoutePassRate * 100).toFixed(1)}% (applicable only)`,
    `realRouteApplicableCount: ${summary.realRouteApplicableCount ?? '—'}`,
    `realRouteSkippedCount: ${summary.realRouteSkippedCount ?? '—'}`,
    `trueScoringFailures: ${summary.totalRealRouteFailures}`,
    '',
    'Grouped true-scoring failure patterns',
    '-----------------------------------',
  ];

  if (!patternReport.groups.length) {
    lines.push('No true-scoring failures among applicable examples.');
    return lines.join('\n');
  }

  for (const group of patternReport.groups) {
    lines.push(`${group.label}: ${group.count}`);
    lines.push(`  examples: ${group.exampleIds.join(', ')}`);
  }

  const confidenceSummary = patternReport.confidenceSummary ?? summarizeDispatcherConfidence(
    patternReport.prioritizedFailures,
  );

  lines.push(
    '',
    'Dispatcher confidence summary',
    '---------------------------',
    `high: ${confidenceSummary.high}`,
    `medium: ${confidenceSummary.medium}`,
    `low: ${confidenceSummary.low}`,
    `true routing mistakes: ${confidenceSummary.byClassification.true_routing_mistake}`,
    `neighboring-tech substitutions: ${confidenceSummary.byClassification.acceptable_neighboring_tech_substitution}`,
    `route-day dependent: ${confidenceSummary.byClassification.route_day_dependent}`,
  );

  lines.push('', 'Top 10 highest-priority failures (tune later, do not fix yet)', '--------------------------------------------------------------');
  for (const failure of patternReport.prioritizedFailures.slice(0, 10)) {
    lines.push(`- ${failure.id} [priority ${failure.priorityScore}]`);
    lines.push(`  dispatcherConfidence: ${failure.dispatcherConfidence ?? '—'}`);
    lines.push(`  failureClassification: ${failure.failureClassification ?? '—'}`);
    lines.push(`  classificationReason: ${failure.classificationReason ?? '—'}`);
    lines.push(`  patterns: ${failure.patterns.map(key => VALIDATION_FAILURE_PATTERN_LABELS[key]).join('; ')}`);
    lines.push(`  expected: ${failure.expectedTechName} | actual #1: ${failure.actualTopTechName ?? '—'}`);
    lines.push(`  dispatcherReason: ${failure.dispatcherReason}`);
  }

  return lines.join('\n');
}
