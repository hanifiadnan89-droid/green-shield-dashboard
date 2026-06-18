/**
 * Route Finder V2 — DEV-only calibration runner.
 * Compares deterministic fixture baseline vs real/scraped FieldRoutes routes.
 */

import { getValidationExamples } from './validationExamples.js';
import {
  buildLeadFromValidationExample,
  evaluateValidationExample,
} from './validationRunner.js';
import { buildDeterministicTechniciansForExample } from './testFixtures/validationReportFixtures.js';
import {
  assertValidationReportDevOnly,
  formatValidationPassRate,
  isValidationReportAllowed,
  runValidationReport,
} from './runValidationReport.js';
import {
  collectRealRouteFailures,
  enrichRealRouteValidationResult,
} from './validationCalibrationDiagnostics.js';
import {
  applyCalibrationApplicability,
  evaluateCalibrationApplicability,
  summarizeRealRouteCalibrationResults,
} from './validationCalibrationApplicability.js';
import {
  createRouteLoader,
  resolveCalibrationRouteDate,
} from './realRouteCalibrationSource.js';
import { scoreSingleDateV2 } from '../routeFinderScoringV2.js';
import {
  buildValidationFailurePatternReport,
  classifyRealRouteFailurePatterns,
  formatValidationFailurePatternReport,
} from './validationFailurePatterns.js';
import {
  classifyDispatcherConfidence,
} from './dispatcherConfidenceClassification.js';
import {
  buildHighConfidenceFailureComparisonsWithRescore,
  formatHighConfidenceFailureComparisonReportFromComparisons,
} from './buildHighConfidenceFailureComparisons.js';

/**
 * @typedef {import('./validationRunner.js').ValidationSummary} ValidationSummary
 * @typedef {import('./validationCalibrationDiagnostics.js').RealRouteValidationRunResult} RealRouteValidationRunResult
 * @typedef {import('./validationCalibrationDiagnostics.js').RealRouteValidationFailureSummary} RealRouteValidationFailureSummary
 * @typedef {import('./realRouteCalibrationSource.js').RouteLoaderForDate} RouteLoaderForDate
 */

/**
 * @typedef {Object} ValidationCalibrationReport
 * @property {string|null} routeDate
 * @property {number} fixturePassRate
 * @property {number} realRoutePassRate
 * @property {number} realRouteApplicableCount
 * @property {number} realRouteSkippedCount
 * @property {import('./validationCalibrationApplicability.js').RealRouteSkippedExampleSummary[]} skippedExamples
 * @property {ValidationSummary['failures']} fixtureFailures
 * @property {RealRouteValidationFailureSummary[]} realRouteFailures
 * @property {{ summary: ValidationSummary, results: import('./validationRunner.js').ValidationRunResult[] }} fixture
 * @property {{ summary: import('./validationCalibrationApplicability.js').RealRouteCalibrationSummary, results: import('./validationCalibrationApplicability.js').RealRouteCalibrationResult[] }} realRoute
 * @property {import('./validationFailurePatterns.js').ValidationFailurePatternReport|null} patternReport
 * @property {string} patternReportText
 * @property {import('./validationFailureScoreComparison.js').FailureScoreComparison[]} highConfidenceScoreComparisons
 * @property {string} highConfidenceScoreComparisonText
 * @property {Record<string, Array<{ techName?: string, stops?: unknown[] }>>} techniciansByExampleId
 * @property {number|null} routeTechnicianCount
 * @property {string} reportText
 */

/**
 * @param {RealRouteValidationFailureSummary} failure
 * @returns {string[]}
 */
function formatRealRouteFailureLines(failure) {
  const lines = [
    `- ${failure.id} (routeDate: ${failure.routeDate})`,
    `  expectedTechName: ${failure.expectedTechName}`,
    `  actualTopTechName: ${failure.actualTopTechName ?? '—'}`,
    `  dispatcherConfidence: ${failure.dispatcherConfidence ?? '—'}`,
    `  failureClassification: ${failure.failureClassification ?? '—'}`,
    `  classificationReason: ${failure.classificationReason ?? '—'}`,
    `  expectedRank: ${failure.expectedRank ?? '—'}`,
    `  stopCount: ${failure.stopCount ?? '—'}`,
    `  over preferred max?: ${failure.overPreferredMax == null ? '—' : failure.overPreferredMax}`,
    `  over hard max?: ${failure.overHardMax == null ? '—' : failure.overHardMax}`,
    `  day mismatch warnings: ${
      failure.dayMismatchWarnings?.length
        ? failure.dayMismatchWarnings.join(' | ')
        : '—'
    }`,
    `  failureReason: ${failure.failureReason ?? '—'}`,
    `  dispatcherReason: ${failure.dispatcherReason}`,
    '  candidate top 3:',
  ];

  for (const candidate of failure.topCandidates ?? []) {
    lines.push(`    #${candidate.rank} ${candidate.techName}`);
    lines.push(`      stopCount: ${candidate.stopCount}`);
    lines.push(`      baseTotal: ${candidate.baseTotal}`);
    lines.push(`      adjustedTotal: ${candidate.adjustedTotal}`);
    lines.push(`      eligibilityStatus: ${candidate.eligibilityStatus}`);
    lines.push(`      over preferred max?: ${candidate.overPreferredMaxStops}`);
    lines.push(`      over hard max?: ${candidate.overHardMaxStops}`);
    lines.push(`      day mismatch warnings: ${
      candidate.dayMismatchWarnings.length
        ? candidate.dayMismatchWarnings.join(' | ')
        : '—'
    }`);
    lines.push(`      penalties: ${JSON.stringify(candidate.penalties)}`);
    lines.push(`      bonuses: ${JSON.stringify(candidate.bonuses)}`);
  }

  lines.push('');
  return lines;
}

function formatSkippedExampleLines(skipped) {
  return [
    `- ${skipped.id}`,
    `  skipReason: ${skipped.skipLabel}`,
    `  expectedTechName: ${skipped.expectedTechName}`,
    `  routeTechnicianCount: ${skipped.routeTechnicianCount}`,
    `  territoryRepresented: ${skipped.territoryRepresented}`,
    `  acceptableTechScheduled: ${skipped.acceptableTechScheduled}`,
    `  dispatcherReason: ${skipped.dispatcherReason}`,
    '',
  ];
}

/**
 * @param {ValidationCalibrationReport} report
 * @returns {string}
 */
export function formatValidationCalibrationReport(report) {
  const lines = [
    'Route Finder V2 — Validation Calibration Report',
    '==============================================',
    `Route date: ${report.routeDate ?? 'per-example'}`,
    `routeTechnicianCount: ${report.routeTechnicianCount ?? '—'}`,
    '',
    'Fixture baseline (logic proof)',
    '------------------------------',
    `fixturePassRate: ${formatValidationPassRate(report.fixturePassRate)}`,
    `passed: ${report.fixture.summary.passed}/${report.fixture.summary.totalExamples}`,
    `fixtureFailures: ${report.fixtureFailures.length}`,
    '',
    'Real-route baseline (field accuracy)',
    '------------------------------------',
    `realRoutePassRate: ${formatValidationPassRate(report.realRoutePassRate)} (applicable examples only)`,
    `realRouteApplicableCount: ${report.realRouteApplicableCount}`,
    `realRouteSkippedCount: ${report.realRouteSkippedCount}`,
    `passed: ${report.realRoute.summary.passed}/${report.realRouteApplicableCount}`,
    `trueScoringFailures: ${report.realRouteFailures.length}`,
  ];

  const skippedExamples = report.skippedExamples ?? [];

  if (!report.fixtureFailures.length && !report.realRouteFailures.length && !skippedExamples.length) {
    lines.push('', 'No fixture failures and no applicable real-route scoring failures.');
    return lines.join('\n');
  }

  if (skippedExamples.length) {
    lines.push('', `Skipped / not applicable (${skippedExamples.length}):`, '');
    for (const skipped of skippedExamples) {
      lines.push(...formatSkippedExampleLines(skipped));
    }
  }

  if (report.fixtureFailures.length) {
    lines.push('', `Fixture failures (${report.fixtureFailures.length}):`, '');
    for (const failure of report.fixtureFailures) {
      lines.push(`- ${failure.id}`);
      lines.push(`  expectedTechName: ${failure.expectedTechName}`);
      lines.push(`  actualTopTechName: ${failure.actualTopTechName ?? '—'}`);
      lines.push(`  expectedRank: ${failure.expectedRank ?? '—'}`);
      lines.push(`  failureReason: ${failure.failureReason ?? '—'}`);
      lines.push(`  dispatcherReason: ${failure.dispatcherReason}`);
      lines.push('');
    }
  }

  if (report.realRouteFailures.length) {
    lines.push('', `True scoring failures (${report.realRouteFailures.length}):`, '');
    for (const failure of report.realRouteFailures) {
      lines.push(...formatRealRouteFailureLines(failure));
    }
  }

  return lines.join('\n');
}

/**
 * @param {ValidationCalibrationReport} report
 */
export function printValidationCalibrationReport(report) {
  if (!isValidationReportAllowed()) return;
  console.log(formatValidationCalibrationReport(report));
}

/**
 * @param {import('./validationExamples.js').RouteFinderValidationExample} example
 * @param {object} lead
 * @param {Array<{ techName?: string }>} technicians
 * @param {number} topN
 */
async function defaultScoreExample(example, lead, technicians, topN) {
  const bundle = await scoreSingleDateV2(technicians, lead, topN, { prefetchTravel: false });
  return bundle.result;
}

/**
 * @param {{
 *   routeDate?: string,
 *   examples?: import('./validationExamples.js').RouteFinderValidationExample[],
 *   topN?: number,
 *   print?: boolean,
 *   loadRoutesForDate?: RouteLoaderForDate,
 *   scoreExample?: Function,
 * }} [options]
 * @returns {Promise<ValidationCalibrationReport>}
 */
export async function runValidationCalibration(options = {}) {
  assertValidationReportDevOnly();

  const examples = options.examples ?? getValidationExamples();
  const topN = options.topN ?? 3;
  const scoreExample = options.scoreExample ?? defaultScoreExample;
  const loadRoutesForDate = createRouteLoader(options);
  const routeDate = options.routeDate ?? null;

  const fixtureRun = await runValidationReport({
    examples,
    topN,
    print: false,
    buildTechnicians: buildDeterministicTechniciansForExample,
    scoreExample,
  });

  const realRouteResults = [];
  const techniciansByExampleId = {};
  const scoringByExampleId = {};
  let routeTechnicianCount = null;

  for (const example of examples) {
    const resolvedRouteDate = resolveCalibrationRouteDate(example, routeDate);
    const payload = await loadRoutesForDate(resolvedRouteDate);
    const technicians = payload?.technicians ?? [];
    if (routeTechnicianCount == null) {
      routeTechnicianCount = technicians.length;
    }
    const lead = buildLeadFromValidationExample(example);
    const applicability = evaluateCalibrationApplicability(example, {
      technicians,
      lead,
      selectedRouteDate: routeDate ?? resolvedRouteDate,
    });
    const scoringResult = await scoreExample(example, lead, technicians, topN);
    const baseResult = evaluateValidationExample(example, technicians, scoringResult);

    techniciansByExampleId[example.id] = technicians;
    scoringByExampleId[example.id] = scoringResult;

    const enriched = enrichRealRouteValidationResult(baseResult, {
      routeDate: resolvedRouteDate,
      technicians,
      scoringResult,
    });

    realRouteResults.push(applyCalibrationApplicability(enriched, applicability));
  }

  const realRouteSummary = summarizeRealRouteCalibrationResults(realRouteResults);
  const realRouteFailures = collectRealRouteFailures(
    realRouteResults.filter(result => result.applicable),
  ).map((failure) => {
    const example = examples.find(row => row.id === failure.id);
    if (!example) return failure;

    const technicians = techniciansByExampleId[failure.id] ?? [];
    const scoringResult = scoringByExampleId[failure.id];
    const patterns = classifyRealRouteFailurePatterns(
      example,
      failure,
      technicians,
      scoringResult,
    );
    const classification = classifyDispatcherConfidence(
      example,
      failure,
      technicians,
      scoringResult,
      patterns,
    );

    return {
      ...failure,
      ...classification,
    };
  });
  const patternReport = buildValidationFailurePatternReport({
    examples,
    results: realRouteResults.filter(result => result.applicable),
    techniciansByExampleId,
    scoringByExampleId,
  });
  const patternReportText = formatValidationFailurePatternReport(patternReport, {
    routeDate,
    fixturePassRate: fixtureRun.summary.passRate,
    realRoutePassRate: realRouteSummary.passRate,
    realRouteApplicableCount: realRouteSummary.realRouteApplicableCount,
    realRouteSkippedCount: realRouteSummary.realRouteSkippedCount,
    totalRealRouteFailures: realRouteFailures.length,
  });

  const highConfidenceFailures = realRouteFailures.filter(
    failure => failure.dispatcherConfidence === 'high',
  );
  const highConfidenceScoreComparisons = highConfidenceFailures.length
    ? await buildHighConfidenceFailureComparisonsWithRescore({
      failures: highConfidenceFailures,
      examples,
      techniciansByExampleId,
      scoreExample,
    })
    : [];
  const highConfidenceScoreComparisonText = formatHighConfidenceFailureComparisonReportFromComparisons(
    highConfidenceScoreComparisons,
  );

  const report = {
    routeDate,
    routeTechnicianCount,
    fixturePassRate: fixtureRun.summary.passRate,
    realRoutePassRate: realRouteSummary.passRate,
    realRouteApplicableCount: realRouteSummary.realRouteApplicableCount,
    realRouteSkippedCount: realRouteSummary.realRouteSkippedCount,
    skippedExamples: realRouteSummary.skippedExamples,
    fixtureFailures: fixtureRun.summary.failures,
    realRouteFailures,
    fixture: {
      summary: fixtureRun.summary,
      results: fixtureRun.results,
    },
    realRoute: {
      summary: realRouteSummary,
      results: realRouteResults,
    },
    patternReport,
    patternReportText,
    highConfidenceScoreComparisons,
    highConfidenceScoreComparisonText,
    techniciansByExampleId,
    reportText: '',
  };

  report.reportText = [
    formatValidationCalibrationReport(report),
    patternReportText,
    highConfidenceScoreComparisonText,
  ].filter(Boolean).join('\n\n');

  if (options.print !== false) {
    printValidationCalibrationReport(report);
    if (!isValidationReportAllowed()) return report;
    console.log('\n' + patternReportText);
    if (highConfidenceScoreComparisonText) {
      console.log('\n' + highConfidenceScoreComparisonText);
    }
  }

  return report;
}
