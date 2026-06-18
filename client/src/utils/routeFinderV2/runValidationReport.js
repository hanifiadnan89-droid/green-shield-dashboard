/**
 * Route Finder V2 — DEV-only validation baseline report runner.
 * Executes all dispatcher validation examples against deterministic fixtures.
 */

import { getValidationExamples } from './validationExamples.js';
import {
  buildLeadFromValidationExample,
  evaluateValidationExample,
  summarizeValidationResults,
} from './validationRunner.js';
import { buildDeterministicTechniciansForExample } from './testFixtures/validationReportFixtures.js';
import { scoreSingleDateV2 } from '../routeFinderScoringV2.js';
import { isViteProdRuntime } from './viteRuntimeEnv.js';

/**
 * @typedef {import('./validationRunner.js').ValidationRunResult} ValidationRunResult
 * @typedef {import('./validationRunner.js').ValidationSummary} ValidationSummary
 */

/**
 * @returns {boolean}
 */
export function isValidationReportAllowed() {
  if (isViteProdRuntime()) {
    return false;
  }
  return true;
}

/**
 * @throws {Error}
 */
export function assertValidationReportDevOnly() {
  if (!isValidationReportAllowed()) {
    throw new Error('Validation report runner is DEV-only and cannot run in production builds.');
  }
}

/**
 * @param {number} passRate
 * @returns {string}
 */
export function formatValidationPassRate(passRate) {
  return `${(passRate * 100).toFixed(1)}%`;
}

/**
 * @param {ValidationSummary} summary
 * @returns {string}
 */
export function formatValidationBaselineReport(summary) {
  const lines = [
    'Route Finder V2 — Validation Baseline Report',
    '===========================================',
    `Total examples: ${summary.totalExamples}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    `Pass rate: ${formatValidationPassRate(summary.passRate)}`,
  ];

  if (!summary.failures.length) {
    lines.push('', 'No failures — all validation examples passed.');
    return lines.join('\n');
  }

  lines.push('', `Failures (${summary.failures.length}):`, '');

  for (const failure of summary.failures) {
    lines.push(`- ${failure.id}`);
    lines.push(`  expectedTechName: ${failure.expectedTechName}`);
    lines.push(`  actualTopTechName: ${failure.actualTopTechName ?? '—'}`);
    lines.push(`  expectedRank: ${failure.expectedRank ?? '—'}`);
    lines.push(`  failureReason: ${failure.failureReason ?? '—'}`);
    lines.push(`  dispatcherReason: ${failure.dispatcherReason}`);
    lines.push('  topMatches:');

    for (const match of failure.topMatches ?? []) {
      lines.push(`    #${match.rank} ${match.techName}`);
      lines.push(`      baseTotal: ${match.baseTotal}`);
      lines.push(`      adjustedTotal: ${match.adjustedTotal}`);
      lines.push(`      eligibilityStatus: ${match.eligibilityStatus}`);
      lines.push(`      penalties: ${JSON.stringify(match.penalties)}`);
      lines.push(`      bonuses: ${JSON.stringify(match.bonuses)}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * @param {ValidationSummary} summary
 */
export function printValidationBaselineReport(summary) {
  if (!isValidationReportAllowed()) return;
  console.log(formatValidationBaselineReport(summary));
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
 *   examples?: import('./validationExamples.js').RouteFinderValidationExample[],
 *   topN?: number,
 *   print?: boolean,
 *   buildTechnicians?: Function,
 *   scoreExample?: Function,
 * }} [options]
 * @returns {Promise<{ summary: ValidationSummary, results: ValidationRunResult[], reportText: string }>}
 */
export async function runValidationReport(options = {}) {
  assertValidationReportDevOnly();

  const examples = options.examples ?? getValidationExamples();
  const topN = options.topN ?? 3;
  const buildTechnicians = options.buildTechnicians ?? buildDeterministicTechniciansForExample;
  const scoreExample = options.scoreExample ?? defaultScoreExample;
  const results = [];

  for (const example of examples) {
    const lead = buildLeadFromValidationExample(example);
    const technicians = buildTechnicians(example, lead);
    const scoringResult = await scoreExample(example, lead, technicians, topN);
    results.push(evaluateValidationExample(example, technicians, scoringResult));
  }

  const summary = summarizeValidationResults(results);
  const reportText = formatValidationBaselineReport(summary);

  if (options.print !== false) {
    printValidationBaselineReport(summary);
  }

  return { summary, results, reportText };
}
