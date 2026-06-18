/**
 * Route Finder V2 — DEV-only calibration runner.
 * Compares deterministic fixture baseline vs real/scraped FieldRoutes routes.
 */

import { getValidationExamples } from './validationExamples.js';
import {
  buildLeadFromValidationExample,
  evaluateValidationExample,
  summarizeValidationResults,
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
  createRouteLoader,
  resolveCalibrationRouteDate,
} from './realRouteCalibrationSource.js';
import { scoreSingleDateV2 } from '../routeFinderScoringV2.js';

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
 * @property {ValidationSummary['failures']} fixtureFailures
 * @property {RealRouteValidationFailureSummary[]} realRouteFailures
 * @property {{ summary: ValidationSummary, results: import('./validationRunner.js').ValidationRunResult[] }} fixture
 * @property {{ summary: ValidationSummary, results: RealRouteValidationRunResult[] }} realRoute
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

/**
 * @param {ValidationCalibrationReport} report
 * @returns {string}
 */
export function formatValidationCalibrationReport(report) {
  const lines = [
    'Route Finder V2 — Validation Calibration Report',
    '==============================================',
    `Route date: ${report.routeDate ?? 'per-example'}`,
    '',
    'Fixture baseline (logic proof)',
    '------------------------------',
    `fixturePassRate: ${formatValidationPassRate(report.fixturePassRate)}`,
    `passed: ${report.fixture.summary.passed}/${report.fixture.summary.totalExamples}`,
    `fixtureFailures: ${report.fixtureFailures.length}`,
    '',
    'Real-route baseline (field accuracy)',
    '------------------------------------',
    `realRoutePassRate: ${formatValidationPassRate(report.realRoutePassRate)}`,
    `passed: ${report.realRoute.summary.passed}/${report.realRoute.summary.totalExamples}`,
    `realRouteFailures: ${report.realRouteFailures.length}`,
  ];

  if (!report.fixtureFailures.length && !report.realRouteFailures.length) {
    lines.push('', 'No failures — fixture and real-route baselines both passed.');
    return lines.join('\n');
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
    lines.push('', `Real-route failures (${report.realRouteFailures.length}):`, '');
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

  for (const example of examples) {
    const resolvedRouteDate = resolveCalibrationRouteDate(example, routeDate);
    const payload = await loadRoutesForDate(resolvedRouteDate);
    const technicians = payload?.technicians ?? [];
    const lead = buildLeadFromValidationExample(example);
    const scoringResult = await scoreExample(example, lead, technicians, topN);
    const baseResult = evaluateValidationExample(example, technicians, scoringResult);

    realRouteResults.push(enrichRealRouteValidationResult(baseResult, {
      routeDate: resolvedRouteDate,
      technicians,
      scoringResult,
    }));
  }

  const realRouteSummary = summarizeValidationResults(realRouteResults);
  const realRouteFailures = collectRealRouteFailures(realRouteResults);

  const report = {
    routeDate,
    fixturePassRate: fixtureRun.summary.passRate,
    realRoutePassRate: realRouteSummary.passRate,
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
    reportText: '',
  };

  report.reportText = formatValidationCalibrationReport(report);

  if (options.print !== false) {
    printValidationCalibrationReport(report);
  }

  return report;
}
