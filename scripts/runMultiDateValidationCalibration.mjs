#!/usr/bin/env node
/**
 * Run real-route calibration across multiple dates and summarize by dispatcherConfidence.
 *
 * Usage (from repo root):
 *   node scripts/runMultiDateValidationCalibration.mjs 2026-06-04 2026-06-05
 *   ROUTE_DATES=2026-06-04,2026-06-05 node scripts/runMultiDateValidationCalibration.mjs
 *
 * Requires data/routes/YYYY-MM-DD.normalized.json for each date (gitignored local cache).
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { runValidationCalibration } from '../client/src/utils/routeFinderV2/runValidationCalibration.js';
import {
  loadNormalizedRoutesFromDisk,
  resolveNormalizedRouteCachePath,
} from '../client/src/utils/routeFinderV2/realRouteCalibrationSource.js';
import {
  normalizeCalibrationReportForSummary,
  summarizeMultiDateCalibration,
} from '../client/src/utils/routeFinderV2/summarizeMultiDateCalibration.js';
import {
  buildHighConfidenceFailureComparisonsWithRescore,
  formatHighConfidenceFailureComparisonReportFromComparisons,
} from '../client/src/utils/routeFinderV2/buildHighConfidenceFailureComparisons.js';
import { hasCorridorOwnerNotScheduledComparisonDiagnostics } from '../client/src/utils/routeFinderV2/validationCalibrationSummarySafety.js';
import { getValidationExamples } from '../client/src/utils/routeFinderV2/validationExamples.js';
import { scoreSingleDateV2 } from '../client/src/utils/routeFinderScoringV2.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

function parseDates(argv) {
  const envDates = (process.env.ROUTE_DATES || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const argDates = argv
    .filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value));

  const dates = argDates.length ? argDates : envDates;
  if (!dates.length) {
    console.error('Usage: node scripts/runMultiDateValidationCalibration.mjs YYYY-MM-DD [YYYY-MM-DD ...]');
    console.error('   or: ROUTE_DATES=YYYY-MM-DD,YYYY-MM-DD node scripts/runMultiDateValidationCalibration.mjs');
    process.exit(1);
  }

  return [...new Set(dates)];
}

const dates = parseDates(process.argv.slice(2));
const missing = [];

for (const date of dates) {
  const cachePath = await resolveNormalizedRouteCachePath(date);
  if (!existsSync(cachePath)) {
    missing.push({ date, cachePath });
  }
}

if (missing.length) {
  console.error('\n[calibration] Missing normalized route cache files:\n');
  for (const entry of missing) {
    console.error(`  - ${entry.date}: ${entry.cachePath}`);
  }
  console.error('\nPlace scraped FieldRoutes cache files under data/routes/ or run:');
  console.error('  node scripts/testLiveRefresh.mjs YYYY-MM-DD');
  process.exit(1);
}

process.env.VITE_ROUTE_FINDER_V2_SCORING = 'true';

const reports = [];

for (const date of dates) {
  const payload = await loadNormalizedRoutesFromDisk(date);
  if (!payload) {
    console.error(`[calibration] Failed to load ${date}`);
    process.exit(1);
  }

  console.error(`[calibration] Running ${date} (${payload.technicians?.length ?? 0} technicians)...`);

  const report = await runValidationCalibration({
    routeDate: date,
    print: false,
    loadRoutesForDate: async () => payload,
  });

  reports.push(report);
}

const normalizedReports = reports.map(normalizeCalibrationReportForSummary);
const summary = summarizeMultiDateCalibration(normalizedReports);

const highConfidenceFailures = normalizedReports.flatMap(report => (
  (report.realRouteFailures ?? []).filter(failure => failure.dispatcherConfidence === 'high')
));
const techniciansByExampleId = Object.assign(
  {},
  ...normalizedReports.map(report => report.techniciansByExampleId ?? {}),
);

async function scoreExample(example, lead, technicians, topN) {
  const bundle = await scoreSingleDateV2(technicians, lead, topN, { prefetchTravel: false });
  return bundle.result;
}

const highConfidenceComparisons = highConfidenceFailures.length
  ? (await buildHighConfidenceFailureComparisonsWithRescore({
    failures: highConfidenceFailures,
    examples: getValidationExamples(),
    techniciansByExampleId,
    scoreExample,
  })).filter(
    comparison => !hasCorridorOwnerNotScheduledComparisonDiagnostics(
      comparison.expectedTerritory,
      comparison.winnerTerritory,
    ),
  )
  : normalizedReports.flatMap(report => (
    (report.highConfidenceScoreComparisons ?? []).filter(
      comparison => !hasCorridorOwnerNotScheduledComparisonDiagnostics(
        comparison.expectedTerritory,
        comparison.winnerTerritory,
      ),
    )
  ));

const highConfidenceComparisonText = formatHighConfidenceFailureComparisonReportFromComparisons(
  highConfidenceComparisons,
);

console.log(summary.reportText);
if (highConfidenceComparisonText) {
  console.log('\n' + highConfidenceComparisonText);
}
