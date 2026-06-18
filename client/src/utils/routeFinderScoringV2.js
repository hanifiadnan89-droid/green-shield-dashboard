/**
 * Route Finder V2 scoring — adapter boundary.
 *
 * Scaffold: delegates to the existing staged scorer so behavior is unchanged.
 * Replace `runV2CoreScoring()` internals when the new algorithm is ready.
 */

import { scoreRoutesAsync } from './fieldRoutesScorer.js';
import { stagedScoreRoutes } from './stagedRouteScoring.js';
import {
  enrichScoringResultWithV2Profiles,
  summarizeV2ProfileStats,
} from './routeFinderV2/technicianEligibility.js';

/** @typedef {'v2-staged-delegate' | 'v2-direct-travel-ctx' | 'v2-haversine-only'} V2ScoringSource */

/**
 * @returns {boolean} True when VITE_ROUTE_FINDER_V2_SCORING is enabled.
 */
export function isRouteFinderV2ScoringEnabled() {
  const raw = import.meta.env.VITE_ROUTE_FINDER_V2_SCORING;
  return raw === 'true' || raw === '1';
}

function logV2(message, detail) {
  if (!import.meta.env.DEV) return;
  if (detail !== undefined) {
    console.debug(`[RouteFinder V2] ${message}`, detail);
  } else {
    console.debug(`[RouteFinder V2] ${message}`);
  }
}

/**
 * V2 scoring core — swap this implementation in future phases.
 * @returns {Promise<{ result: object, travelCtx: object|null, stagingDiagnostics: object|null, scoringSource: V2ScoringSource }>}
 */
async function runV2CoreScoring(technicians, lead, topN, options = {}) {
  let travelCtx = options.travelCtx ?? null;
  let result;
  let stagingDiagnostics = null;
  /** @type {V2ScoringSource} */
  let scoringSource = 'v2-staged-delegate';

  if (travelCtx) {
    result = await scoreRoutesAsync(technicians, lead, topN, {
      ...options,
      travelCtx,
      prefetchTravel: false,
    });
    scoringSource = 'v2-direct-travel-ctx';
  } else if (options.prefetchTravel === false) {
    result = await scoreRoutesAsync(technicians, lead, topN, {
      ...options,
      prefetchTravel: false,
    });
    scoringSource = 'v2-haversine-only';
  } else {
    const staged = await stagedScoreRoutes(technicians, lead, topN, options);
    result = staged.result;
    travelCtx = staged.travelCtx;
    stagingDiagnostics = staged.stagingDiagnostics;
    scoringSource = 'v2-staged-delegate';
  }

  return { result, travelCtx, stagingDiagnostics, scoringSource };
}

/**
 * V2 single-date scoring entry (raw scorer output — enrichment happens in routeFinderScoring.js).
 *
 * @returns {Promise<{
 *   result: object,
 *   travelCtx: object|null,
 *   stagingDiagnostics: object|null,
 *   scoringEngine: 'v2',
 *   scoringSource: V2ScoringSource,
 * }>}
 */
export async function scoreSingleDateV2(technicians, lead, topN = 3, options = {}) {
  const techCount = technicians?.length ?? 0;

  if (import.meta.env.DEV) {
    console.debug('Route Finder V2 scoring enabled');
  }
  logV2('technicians scored', techCount);

  const { result: rawResult, travelCtx, stagingDiagnostics, scoringSource } = await runV2CoreScoring(
    technicians,
    lead,
    topN,
    options,
  );

  const result = enrichScoringResultWithV2Profiles(rawResult, lead, technicians);
  const profileStats = summarizeV2ProfileStats(result?.topMatches ?? []);
  logV2('profile enrichment', profileStats);

  logV2('result source', {
    scoringSource,
    totalRoutesScored: result?.totalRoutesScored ?? 0,
    topMatchCount: result?.topMatches?.length ?? 0,
    noSafeRoute: Boolean(result?.noSafeRoute),
    ...profileStats,
  });

  return {
    result,
    travelCtx,
    stagingDiagnostics,
    scoringEngine: 'v2',
    scoringSource,
  };
}
