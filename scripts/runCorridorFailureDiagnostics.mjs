#!/usr/bin/env node
/**
 * Score-comparison diagnostics for dispatcher-confirmed corridor failures.
 *
 * Usage (from repo root):
 *   node scripts/runCorridorFailureDiagnostics.mjs
 *   ROUTE_DATE=2026-06-04 node scripts/runCorridorFailureDiagnostics.mjs
 *
 * Uses data/routes/YYYY-MM-DD.normalized.json when present; otherwise falls back to
 * the corridor diagnostic fixture (same technician roster, representative stops).
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getValidationExampleById } from '../client/src/utils/routeFinderV2/validationExamples.js';
import { buildLeadFromValidationExample } from '../client/src/utils/routeFinderV2/validationRunner.js';
import { scoreSingleDateV2 } from '../client/src/utils/routeFinderScoringV2.js';
import {
  buildExplicitScoreComparison,
} from '../client/src/utils/routeFinderV2/validationFailureScoreComparison.js';
import { formatCorridorScoreComparisonReport } from '../client/src/utils/routeFinderV2/formatCorridorScoreComparisonReport.js';
import {
  CORRIDOR_CONFIRMED_WINNERS,
  CORRIDOR_DIAGNOSTIC_ROUTE_PAYLOADS,
  CORRIDOR_FAILURE_EXAMPLE_IDS,
} from '../client/src/utils/routeFinderV2/testFixtures/corridorFailureDiagnostics.fixture.js';
import {
  loadNormalizedRoutesFromDisk,
  resolveNormalizedRouteCachePath,
} from '../client/src/utils/routeFinderV2/realRouteCalibrationSource.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

const routeDates = (process.env.ROUTE_DATES || process.env.ROUTE_DATE || '2026-06-04,2026-06-05')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

process.env.VITE_ROUTE_FINDER_V2_SCORING = 'true';

/**
 * @param {string} date
 */
async function loadRoutesForDate(date) {
  const cachePath = await resolveNormalizedRouteCachePath(date);
  if (existsSync(cachePath)) {
    const payload = await loadNormalizedRoutesFromDisk(date);
    if (payload) {
      console.error(`[corridor-diagnostics] Using disk cache: ${cachePath}`);
      return payload;
    }
  }

  const fixture = CORRIDOR_DIAGNOSTIC_ROUTE_PAYLOADS[date];
  if (fixture) {
    console.error(`[corridor-diagnostics] Using corridor diagnostic fixture for ${date}`);
    return fixture;
  }

  throw new Error(`No route cache or corridor fixture for ${date}`);
}

const comparisons = [];

for (const routeDate of routeDates) {
  const payload = await loadRoutesForDate(routeDate);
  const technicians = payload.technicians ?? [];

  for (const exampleId of CORRIDOR_FAILURE_EXAMPLE_IDS) {
    const example = getValidationExampleById(exampleId);
    if (!example) continue;

    const winningTechName = CORRIDOR_CONFIRMED_WINNERS[exampleId];
    const lead = buildLeadFromValidationExample(example);
    const bundle = await scoreSingleDateV2(
      technicians,
      lead,
      technicians.length,
      { prefetchTravel: false },
    );

    comparisons.push(buildExplicitScoreComparison(
      example,
      winningTechName,
      technicians,
      bundle.result,
      routeDate,
    ));
  }
}

console.log(formatCorridorScoreComparisonReport(comparisons));
