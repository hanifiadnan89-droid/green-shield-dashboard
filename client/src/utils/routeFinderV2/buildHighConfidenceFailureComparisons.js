/**
 * Build high-confidence failure comparisons with full-route rescoring.
 */

import { getValidationExamples } from './validationExamples.js';
import {
  buildFailureScoreComparison,
  formatFailureScoreComparisonTable,
  scoreExampleForFailureComparison,
} from './validationFailureScoreComparison.js';

/**
 * @param {{
 *   failures: Array<import('./validationCalibrationDiagnostics.js').RealRouteValidationFailureSummary & {
 *     dispatcherConfidence?: string,
 *     failureClassification?: string,
 *   }>,
 *   examples?: import('./validationExamples.js').RouteFinderValidationExample[],
 *   techniciansByExampleId?: Record<string, Array<{ routeId?: string|number, stops?: unknown[] }>>,
 *   scoreExample: (example: object, lead: object, technicians: Array<object>, topN: number) => Promise<object>,
 * }} input
 * @returns {Promise<import('./validationFailureScoreComparison.js').FailureScoreComparison[]>}
 */
export async function buildHighConfidenceFailureComparisonsWithRescore(input) {
  const examples = input.examples ?? getValidationExamples();
  const exampleById = new Map(examples.map(example => [example.id, example]));
  const comparisons = [];

  for (const failure of input.failures) {
    if (failure.dispatcherConfidence !== 'high') continue;

    const example = exampleById.get(failure.id);
    if (!example) continue;

    const technicians = input.techniciansByExampleId?.[failure.id] ?? [];
    const scoringResult = await scoreExampleForFailureComparison(
      example,
      technicians,
      input.scoreExample,
    );

    comparisons.push(buildFailureScoreComparison(
      example,
      failure,
      technicians,
      scoringResult,
    ));
  }

  return comparisons;
}

/**
 * @param {Awaited<ReturnType<typeof buildHighConfidenceFailureComparisonsWithRescore>>} comparisons
 * @returns {string}
 */
export function formatHighConfidenceFailureComparisonReportFromComparisons(comparisons) {
  return formatFailureScoreComparisonTable(comparisons);
}
