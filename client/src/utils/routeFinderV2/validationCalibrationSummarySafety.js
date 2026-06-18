/**
 * Route Finder V2 — final summary safety gates for real-route calibration.
 * Reporting only; does not change scoring.
 */

import {
  CALIBRATION_SKIP_REASON_LABELS,
  summarizeRealRouteCalibrationResults,
} from './validationCalibrationApplicability.js';
import {
  buildComparisonTerritoryDiagnostic,
  buildFailureScoreComparison,
  scoreExampleForFailureComparison,
} from './validationFailureScoreComparison.js';
import { getValidationExamples } from './validationExamples.js';
import { resolvePostSafetyGateRealRouteFailures } from './summarizeMultiDateCalibration.js';

/**
 * @typedef {import('./validationExamples.js').RouteFinderValidationExample} RouteFinderValidationExample
 * @typedef {import('./validationCalibrationApplicability.js').RealRouteCalibrationResult} RealRouteCalibrationResult
 * @typedef {import('./runValidationCalibration.js').ValidationCalibrationReport} ValidationCalibrationReport
 */

const WINDHAM_EXAMPLE_ID = 'windham-general-example-024';

/**
 * @param {ValidationCalibrationReport} report
 * @returns {import('./validationCalibrationDiagnostics.js').RealRouteValidationFailureSummary[]}
 */
function resolveFailuresForComparisonSafetyGate(report) {
  const failuresById = new Map();
  for (const failure of report.realRouteFailures ?? []) {
    failuresById.set(failure.id, failure);
  }
  for (const failure of resolvePostSafetyGateRealRouteFailures(report)) {
    failuresById.set(failure.id, {
      ...failuresById.get(failure.id),
      ...failure,
    });
  }
  return [...failuresById.values()];
}

/**
 * Mutate a calibration report using the same comparison diagnostics shown in the
 * high-confidence failure comparison table. This is the multi-date source of truth.
 *
 * @param {ValidationCalibrationReport} report
 * @param {(
 *   example: RouteFinderValidationExample,
 *   lead: object,
 *   technicians: Array<object>,
 *   topN: number,
 * ) => Promise<object>} scoreExample
 * @param {RouteFinderValidationExample[]} examples
 * @returns {Promise<{ report: ValidationCalibrationReport, windhamSafetyGateApplied: boolean }>}
 */
export async function finalizeCalibrationReportForMultiDateOutput(
  report,
  scoreExample,
  examples,
) {
  const exampleById = new Map(examples.map(example => [example.id, example]));
  const failures = resolveFailuresForComparisonSafetyGate(report);
  const excludedIds = new Set();
  let windhamSafetyGateApplied = false;

  for (const failure of failures) {
    const example = exampleById.get(failure.id);
    if (!example) continue;

    const technicians = report.techniciansByExampleId?.[failure.id] ?? [];
    const scoringResult = await scoreExampleForFailureComparison(
      example,
      technicians,
      scoreExample,
    );
    const comparison = buildFailureScoreComparison(
      example,
      failure,
      technicians,
      scoringResult,
    );

    if (hasCorridorOwnerNotScheduledComparisonDiagnostics(
      comparison.expectedTerritory,
      comparison.winnerTerritory,
    )) {
      excludedIds.add(failure.id);
      if (failure.id === WINDHAM_EXAMPLE_ID) {
        windhamSafetyGateApplied = true;
      }
    }
  }

  if (!excludedIds.size) {
    return { report, windhamSafetyGateApplied: false };
  }

  const results = Array.isArray(report.realRoute?.results)
    ? report.realRoute.results
    : [];
  const filteredResults = results.map((result) => {
    if (!excludedIds.has(result.id)) return result;
    return reclassifyRealRouteResultAsCorridorOwnerNotScheduled(result);
  });
  const routeSummary = summarizeRealRouteCalibrationResults(filteredResults);
  const filteredFailures = failures.filter(failure => !excludedIds.has(failure.id));

  return {
    report: {
      ...report,
      comparisonSafetyGateApplied: true,
      realRoutePassRate: routeSummary.passRate,
      realRouteApplicableCount: routeSummary.realRouteApplicableCount,
      realRouteSkippedCount: routeSummary.realRouteSkippedCount,
      skippedExamples: routeSummary.skippedExamples,
      realRouteFailures: filteredFailures,
      highConfidenceScoreComparisons: (report.highConfidenceScoreComparisons ?? []).filter(
        comparison => !excludedIds.has(comparison.exampleId),
      ),
      realRoute: {
        ...report.realRoute,
        summary: routeSummary,
        results: filteredResults,
      },
    },
    windhamSafetyGateApplied,
  };
}

/**
 * @param {ValidationCalibrationReport[]} reports
 * @param {(
 *   example: RouteFinderValidationExample,
 *   lead: object,
 *   technicians: Array<object>,
 *   topN: number,
 * ) => Promise<object>} scoreExample
 * @param {RouteFinderValidationExample[]} [examples]
 * @returns {Promise<ValidationCalibrationReport[]>}
 */
export async function prepareCalibrationReportsForMultiDateSummary(
  reports,
  scoreExample,
  examples = getValidationExamples(),
) {
  const finalized = await Promise.all(
    reports.map(report => finalizeCalibrationReportForMultiDateOutput(
      report,
      scoreExample,
      examples,
    )),
  );
  return finalized.map(entry => entry.report);
}

/**
 * @param {{
 *   scheduled?: boolean,
 *   unavailabilityReasons?: string[],
 * }|null|undefined} territoryDiagnostic
 * @returns {boolean}
 */
export function isTerritoryDiagnosticNotScheduled(territoryDiagnostic) {
  if (!territoryDiagnostic || territoryDiagnostic.scheduled !== false) return false;
  return (territoryDiagnostic.unavailabilityReasons ?? []).includes('not_scheduled');
}

/**
 * @param {{
 *   scheduled?: boolean,
 *   unavailabilityReasons?: string[],
 * }|null|undefined} expectedTerritory
 * @param {{
 *   scheduled?: boolean,
 *   unavailabilityReasons?: string[],
 * }|null|undefined} winnerTerritory
 * @returns {boolean}
 */
export function hasCorridorOwnerNotScheduledComparisonDiagnostics(
  expectedTerritory,
  winnerTerritory,
) {
  return isTerritoryDiagnosticNotScheduled(expectedTerritory)
    && isTerritoryDiagnosticNotScheduled(winnerTerritory);
}

/**
 * @param {RealRouteCalibrationResult} result
 * @returns {RealRouteCalibrationResult}
 */
export function reclassifyRealRouteResultAsCorridorOwnerNotScheduled(result) {
  return {
    ...result,
    applicable: false,
    skipReason: 'expected_corridor_owner_not_scheduled',
    skipLabel: CALIBRATION_SKIP_REASON_LABELS.expected_corridor_owner_not_scheduled,
    calibrationOutcome: 'skipped',
    countedInRealRoutePassRate: false,
  };
}

/**
 * @param {RealRouteCalibrationResult} result
 * @param {RouteFinderValidationExample} example
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>} technicians
 * @param {object|null|undefined} scoringResult
 * @returns {boolean}
 */
export function shouldReclassifyFailureFromComparisonDiagnostics(
  result,
  example,
  technicians,
  scoringResult,
) {
  if (!result.applicable || result.passed) return false;

  const winningTechName = result.actualTopTechName;
  if (!winningTechName) return false;

  const expectedTerritory = buildComparisonTerritoryDiagnostic(
    example,
    result.expectedTechName,
    scoringResult,
    technicians,
  );
  const winnerTerritory = buildComparisonTerritoryDiagnostic(
    example,
    winningTechName,
    scoringResult,
    technicians,
  );

  return hasCorridorOwnerNotScheduledComparisonDiagnostics(
    expectedTerritory,
    winnerTerritory,
  );
}

/**
 * Final safety gate: if comparison diagnostics show both expected and winner are
 * not scheduled on the route cache, reclassify before summary aggregation.
 *
 * @param {{
 *   realRouteResults: RealRouteCalibrationResult[],
 *   examples: RouteFinderValidationExample[],
 *   techniciansByExampleId?: Record<string, Array<{ routeId?: string|number, stops?: unknown[] }>>,
 *   scoringByExampleId?: Record<string, object|null|undefined>,
 *   scoreExample: (
 *     example: RouteFinderValidationExample,
 *     lead: object,
 *     technicians: Array<object>,
 *     topN: number,
 *   ) => Promise<object>,
 * }} input
 * @returns {Promise<RealRouteCalibrationResult[]>}
 */
export async function applyCorridorOwnerNotScheduledSummarySafetyGate(input) {
  const exampleById = new Map(input.examples.map(example => [example.id, example]));
  const updatedResults = [...input.realRouteResults];

  for (let index = 0; index < updatedResults.length; index += 1) {
    const result = updatedResults[index];
    if (!result.applicable || result.passed) continue;

    const example = exampleById.get(result.id);
    if (!example) continue;

    const technicians = input.techniciansByExampleId?.[result.id] ?? [];
    const scoringResult = await scoreExampleForFailureComparison(
      example,
      technicians,
      input.scoreExample,
    );

    if (shouldReclassifyFailureFromComparisonDiagnostics(
      result,
      example,
      technicians,
      scoringResult,
    )) {
      updatedResults[index] = reclassifyRealRouteResultAsCorridorOwnerNotScheduled(result);
    }
  }

  return updatedResults;
}

/**
 * @param {import('./validationCalibrationDiagnostics.js').RealRouteValidationFailureSummary} failure
 * @param {RouteFinderValidationExample} example
 * @param {Array<{ routeId?: string|number, stops?: unknown[] }>} technicians
 * @param {object|null|undefined} scoringResult
 * @returns {boolean}
 */
export function shouldExcludeFailureFromComparisonDiagnostics(
  failure,
  example,
  technicians,
  scoringResult,
) {
  return shouldReclassifyFailureFromComparisonDiagnostics(
    {
      ...failure,
      applicable: true,
      passed: false,
    },
    example,
    technicians,
    scoringResult,
  );
}

/**
 * @deprecated Use finalizeCalibrationReportForMultiDateOutput instead.
 */
export async function applyComparisonDiagnosticFailureFilterToReport(
  report,
  scoreExample,
  examples,
) {
  const { report: finalized } = await finalizeCalibrationReportForMultiDateOutput(
    report,
    scoreExample,
    examples,
  );
  return finalized;
}
