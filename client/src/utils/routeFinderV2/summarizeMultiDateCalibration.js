/**
 * Route Finder V2 — aggregate multi-date calibration results and recommendations.
 * Reporting only; does not change scoring weights.
 */

import {
  FAILURE_CLASSIFICATION_LABELS,
  DISPATCHER_CONFIDENCE_LABELS,
} from './dispatcherConfidenceClassification.js';
import { collectRealRouteFailures } from './validationCalibrationDiagnostics.js';

/**
 * @typedef {import('./runValidationCalibration.js').ValidationCalibrationReport} ValidationCalibrationReport
 */

/**
 * @typedef {Object} ClassifiedFailureRow
 * @property {string} id
 * @property {string} routeDate
 * @property {string} expectedTechName
 * @property {string|null} actualTopTechName
 * @property {number|null} expectedRank
 * @property {string} failureClassification
 * @property {string} dispatcherConfidence
 * @property {string} classificationReason
 * @property {string} dispatcherReason
 * @property {string[]|undefined} patterns
 */

/**
 * @typedef {Object} MultiDateCalibrationSummary
 * @property {string[]} routeDates
 * @property {number} totalApplicableFailures
 * @property {{ high: ClassifiedFailureRow[], medium: ClassifiedFailureRow[], low: ClassifiedFailureRow[] }} byConfidence
 * @property {Array<ClassifiedFailureRow & { occurrenceCount: number, routeDates: string[] }>} repeatedHighConfidenceMistakes
 * @property {{ scoringChanges: string[], validationDatasetUpdates: string[] }} recommendations
 * @property {string} reportText
 */

/**
 * Resolve true scoring failures from post-safety-gate real-route results.
 * Top-level report.realRouteFailures can lag behind report.realRoute.results
 * when summary safety gates reclassify examples after failure classification.
 *
 * @param {ValidationCalibrationReport} report
 * @returns {import('./validationCalibrationDiagnostics.js').RealRouteValidationFailureSummary[]}
 */
export function resolvePostSafetyGateRealRouteFailures(report) {
  if (report.comparisonSafetyGateApplied) {
    return report.realRouteFailures ?? [];
  }
  const results = report.realRoute?.results;
  if (!Array.isArray(results)) {
    return report.realRouteFailures ?? [];
  }

  const applicableFailedResults = results.filter(
    result => result.applicable && !result.passed,
  );
  const classifiedById = new Map(
    (report.realRouteFailures ?? []).map(failure => [failure.id, failure]),
  );

  return collectRealRouteFailures(applicableFailedResults).map((failure) => {
    const classified = classifiedById.get(failure.id);
    return classified ? { ...classified, ...failure } : failure;
  });
}

/**
 * Normalize a calibration report so summary consumers use post-safety-gate
 * real-route results for pass rates, skipped examples, and failure lists.
 *
 * @param {ValidationCalibrationReport} report
 * @returns {ValidationCalibrationReport}
 */
export function normalizeCalibrationReportForSummary(report) {
  if (report.comparisonSafetyGateApplied) {
    return report;
  }
  const routeSummary = report.realRoute?.summary;
  const realRouteFailures = resolvePostSafetyGateRealRouteFailures(report);

  return {
    ...report,
    realRoutePassRate: routeSummary?.passRate ?? report.realRoutePassRate,
    realRouteApplicableCount: routeSummary?.realRouteApplicableCount ?? report.realRouteApplicableCount,
    realRouteSkippedCount: routeSummary?.realRouteSkippedCount ?? report.realRouteSkippedCount,
    skippedExamples: routeSummary?.skippedExamples ?? report.skippedExamples ?? [],
    realRouteFailures,
  };
}

/**
 * @param {ValidationCalibrationReport} report
 * @returns {ClassifiedFailureRow[]}
 */
export function extractClassifiedFailuresFromReport(report) {
  return resolvePostSafetyGateRealRouteFailures(report).map(failure => ({
    id: failure.id,
    routeDate: failure.routeDate,
    expectedTechName: failure.expectedTechName,
    actualTopTechName: failure.actualTopTechName ?? null,
    expectedRank: failure.expectedRank ?? null,
    failureClassification: failure.failureClassification ?? 'unknown',
    dispatcherConfidence: failure.dispatcherConfidence ?? 'unknown',
    classificationReason: failure.classificationReason ?? '',
    dispatcherReason: failure.dispatcherReason ?? '',
    patterns: report.patternReport?.patternsByExampleId?.[failure.id],
  }));
}

/**
 * @param {ClassifiedFailureRow[]} rows
 * @returns {Array<ClassifiedFailureRow & { occurrenceCount: number, routeDates: string[] }>}
 */
export function findRepeatedHighConfidenceMistakes(rows) {
  const highRows = rows.filter(
    row => row.dispatcherConfidence === 'high'
      && row.failureClassification === 'true_routing_mistake',
  );

  const grouped = new Map();
  for (const row of highRows) {
    const key = `${row.id}::${row.actualTopTechName ?? '—'}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...row,
        occurrenceCount: 0,
        routeDates: [],
      });
    }
    const entry = grouped.get(key);
    entry.occurrenceCount += 1;
    if (!entry.routeDates.includes(row.routeDate)) {
      entry.routeDates.push(row.routeDate);
    }
  }

  return [...grouped.values()]
    .filter(entry => entry.occurrenceCount >= 2 || entry.routeDates.length >= 2)
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);
}

/**
 * @param {ValidationCalibrationReport[]} reports
 * @returns {MultiDateCalibrationSummary}
 */
export function summarizeMultiDateCalibration(reports = []) {
  const normalizedReports = reports.map(normalizeCalibrationReportForSummary);
  const routeDates = normalizedReports.map(report => report.routeDate).filter(Boolean);
  const allFailures = normalizedReports.flatMap(extractClassifiedFailuresFromReport);

  const byConfidence = {
    high: allFailures.filter(row => row.dispatcherConfidence === 'high'),
    medium: allFailures.filter(row => row.dispatcherConfidence === 'medium'),
    low: allFailures.filter(row => row.dispatcherConfidence === 'low'),
  };

  const repeatedHighConfidenceMistakes = findRepeatedHighConfidenceMistakes(allFailures);

  const scoringChanges = repeatedHighConfidenceMistakes.map((row) => {
    return [
      `**${row.id}** (${row.routeDates.join(', ')})`,
      `  Expected ${row.expectedTechName}, scored #1 ${row.actualTopTechName ?? '—'}`,
      `  ${row.classificationReason}`,
      '  → Tune scoring weights/penalties for this corridor mismatch (repeated high-confidence mistake).',
    ].join('\n');
  });

  const validationDatasetUpdates = [];

  for (const row of byConfidence.medium) {
    validationDatasetUpdates.push([
      `**${row.id}** (${row.routeDate}) — medium / neighboring substitution`,
      `  Expected ${row.expectedTechName}, scored #1 ${row.actualTopTechName ?? '—'}`,
      `  Consider widening acceptableTechNames or raising acceptedRankMax if dispatcher accepts either tech.`,
      `  dispatcherReason: ${row.dispatcherReason}`,
    ].join('\n'));
  }

  for (const row of byConfidence.low) {
    validationDatasetUpdates.push([
      `**${row.id}** (${row.routeDate}) — low / route-day dependent`,
      `  Expected ${row.expectedTechName}, scored #1 ${row.actualTopTechName ?? '—'} (rank ${row.expectedRank ?? '—'})`,
      `  Prefer validation dataset updates (acceptableTechNames, acceptedRankMax) over weight tuning.`,
      `  dispatcherReason: ${row.dispatcherReason}`,
    ].join('\n'));
  }

  const singleDateHighMistakes = byConfidence.high.filter((row) => {
    const key = `${row.id}::${row.actualTopTechName ?? '—'}`;
    return !repeatedHighConfidenceMistakes.some(
      repeated => `${repeated.id}::${repeated.actualTopTechName ?? '—'}` === key,
    );
  });

  if (singleDateHighMistakes.length) {
    scoringChanges.push(
      '',
      'Single-date high-confidence mistakes (monitor; tune only if pattern repeats on more route days):',
      ...singleDateHighMistakes.map(row => (
        `- ${row.id} (${row.routeDate}): ${row.expectedTechName} vs ${row.actualTopTechName ?? '—'} — ${row.classificationReason}`
      )),
    );
  }

  const reportText = formatMultiDateCalibrationReport({
    routeDates,
    totalApplicableFailures: allFailures.length,
    byConfidence,
    repeatedHighConfidenceMistakes,
    recommendations: {
      scoringChanges,
      validationDatasetUpdates,
    },
    perDateStats: normalizedReports.map(report => ({
      routeDate: report.routeDate,
      fixturePassRate: report.fixturePassRate,
      realRoutePassRate: report.realRoutePassRate,
      realRouteApplicableCount: report.realRouteApplicableCount,
      realRouteSkippedCount: report.realRouteSkippedCount,
      trueScoringFailures: report.realRouteFailures.length,
    })),
  });

  return {
    routeDates,
    totalApplicableFailures: allFailures.length,
    byConfidence,
    repeatedHighConfidenceMistakes,
    recommendations: {
      scoringChanges,
      validationDatasetUpdates,
    },
    reportText,
  };
}

/**
 * @param {object} input
 * @returns {string}
 */
export function formatMultiDateCalibrationReport(input) {
  const lines = [
    'Route Finder V2 — Multi-Date Calibration Summary',
    '==============================================',
    `Route dates: ${input.routeDates.join(', ') || '—'}`,
    `Total applicable failures: ${input.totalApplicableFailures}`,
    '',
    'Per-date pass rates',
    '-------------------',
  ];

  for (const stat of input.perDateStats ?? []) {
    lines.push(
      `${stat.routeDate}: fixture ${(stat.fixturePassRate * 100).toFixed(1)}% | `
      + `real ${(stat.realRoutePassRate * 100).toFixed(1)}% `
      + `(${stat.realRouteApplicableCount} applicable, ${stat.realRouteSkippedCount} skipped, `
      + `${stat.trueScoringFailures} failures)`,
    );
  }

  lines.push(
    '',
    `High confidence (${DISPATCHER_CONFIDENCE_LABELS.high} / ${FAILURE_CLASSIFICATION_LABELS.true_routing_mistake})`,
    '--------------------------------------------------------------------------------',
  );
  if (!input.byConfidence.high.length) {
    lines.push('None.');
  } else {
    for (const row of input.byConfidence.high) {
      lines.push(`- ${row.id} (${row.routeDate})`);
      lines.push(`  expected: ${row.expectedTechName} | actual #1: ${row.actualTopTechName ?? '—'}`);
      lines.push(`  reason: ${row.classificationReason}`);
    }
  }

  lines.push(
    '',
    `Medium confidence (${DISPATCHER_CONFIDENCE_LABELS.medium} / ${FAILURE_CLASSIFICATION_LABELS.acceptable_neighboring_tech_substitution})`,
    '--------------------------------------------------------------------------------------------------',
  );
  if (!input.byConfidence.medium.length) {
    lines.push('None.');
  } else {
    for (const row of input.byConfidence.medium) {
      lines.push(`- ${row.id} (${row.routeDate})`);
      lines.push(`  expected: ${row.expectedTechName} | actual #1: ${row.actualTopTechName ?? '—'}`);
      lines.push(`  reason: ${row.classificationReason}`);
    }
  }

  lines.push(
    '',
    `Low confidence (${DISPATCHER_CONFIDENCE_LABELS.low} / ${FAILURE_CLASSIFICATION_LABELS.route_day_dependent})`,
    '---------------------------------------------------------------------------------------------',
  );
  if (!input.byConfidence.low.length) {
    lines.push('None.');
  } else {
    for (const row of input.byConfidence.low) {
      lines.push(`- ${row.id} (${row.routeDate})`);
      lines.push(`  expected: ${row.expectedTechName} | actual #1: ${row.actualTopTechName ?? '—'}`);
      lines.push(`  reason: ${row.classificationReason}`);
    }
  }

  lines.push(
    '',
    'Recommendations',
    '---------------',
    '',
    'Scoring changes (repeated high-confidence mistakes only):',
  );
  if (!input.repeatedHighConfidenceMistakes.length) {
    lines.push('No repeated high-confidence mistakes across selected dates — hold weight tuning.');
  } else {
    for (const row of input.repeatedHighConfidenceMistakes) {
      lines.push(`- ${row.id}: ${row.expectedTechName} vs ${row.actualTopTechName ?? '—'} on ${row.routeDates.join(', ')}`);
      lines.push(`  ${row.classificationReason}`);
    }
  }

  lines.push('', 'Validation dataset updates (medium/low — not weight tuning):');
  const datasetUpdates = input.recommendations?.validationDatasetUpdates ?? [];
  if (!datasetUpdates.length) {
    lines.push('None.');
  } else {
    lines.push(...datasetUpdates.map(block => `${block}\n`));
  }

  return lines.join('\n');
}
