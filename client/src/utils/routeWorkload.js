/**
 * Route workload assessment for dispatcher-grade Route Finder scoring.
 */

import { enrichStopsWithDurations } from './routeServiceDurationRules.js';

/** @typedef {'healthy' | 'near-capacity' | 'heavy' | 'avoid-if-possible'} WorkloadLabel */

export const ROUTE_WORKLOAD_CONFIG = {
  preferredMaxStops: 10,
  softMaxStops: 11,
  heavyRouteStops: 12,
  heavyRoutePenalty: 18,
  nearCapacityPenalty: 8,
  allowHeavyRouteFallback: true,
  /** Prefer lighter route when within this score gap of the top pick. */
  lighterRouteScoreGap: 12,
  lighterRouteMaxStops: 10,
};

/**
 * @typedef {'unknown' | 'optimized' | 'inferred-heavy' | 'not-optimized'} RouteOptimizationStatus
 */

/**
 * FieldRoutes does not expose a reliable optimized flag in the normalized payload.
 * Infer status from metadata and stop count.
 * @param {Object} tech
 * @param {number} stopCount
 */
export function inferRouteOptimizationStatus(tech, stopCount) {
  const raw = [
    tech?.routeTitle,
    tech?.estimatedTotalDuration,
    tech?.totalDistanceMiles,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\boptimi[sz]ed\b/i.test(raw)) {
    return 'optimized';
  }

  if (stopCount >= ROUTE_WORKLOAD_CONFIG.heavyRouteStops) {
    return 'inferred-heavy';
  }

  if (stopCount >= ROUTE_WORKLOAD_CONFIG.softMaxStops) {
    return 'inferred-heavy';
  }

  return 'unknown';
}

/**
 * @param {number} stopCount
 * @returns {WorkloadLabel}
 */
export function workloadLabelForStopCount(stopCount) {
  if (stopCount >= ROUTE_WORKLOAD_CONFIG.heavyRouteStops) return 'avoid-if-possible';
  if (stopCount >= ROUTE_WORKLOAD_CONFIG.softMaxStops) return 'heavy';
  if (stopCount > ROUTE_WORKLOAD_CONFIG.preferredMaxStops) return 'near-capacity';
  return 'healthy';
}

export function workloadLabelDisplay(label) {
  switch (label) {
    case 'healthy': return 'Healthy workload';
    case 'near-capacity': return 'Near capacity';
    case 'heavy': return 'Heavy route';
    case 'avoid-if-possible': return 'Avoid if possible';
    default: return 'Unknown workload';
  }
}

/**
 * @param {Object} tech
 * @param {Array<Object>} [stops]
 */
export function assessRouteWorkload(tech, stops = tech?.stops ?? []) {
  const withCoords = stops.filter(s => s.lat && s.lng);
  const { stops: enrichedStops, fallbackCount, warnings } = enrichStopsWithDurations(withCoords);
  const stopCount = withCoords.length;
  const currentServiceMinutes = enrichedStops.reduce((sum, s) => sum + (s.durationMinutes || 30), 0);
  const workloadLabel = workloadLabelForStopCount(stopCount);
  const routeOptimizationStatus = inferRouteOptimizationStatus(tech, stopCount);

  let penalty = 0;
  if (stopCount >= ROUTE_WORKLOAD_CONFIG.heavyRouteStops) {
    penalty = ROUTE_WORKLOAD_CONFIG.heavyRoutePenalty;
  } else if (stopCount > ROUTE_WORKLOAD_CONFIG.preferredMaxStops) {
    penalty = ROUTE_WORKLOAD_CONFIG.nearCapacityPenalty;
  }

  const isHeavy =
    stopCount >= ROUTE_WORKLOAD_CONFIG.heavyRouteStops ||
    (routeOptimizationStatus === 'inferred-heavy' && stopCount >= ROUTE_WORKLOAD_CONFIG.softMaxStops);

  return {
    stopCount,
    currentServiceMinutes,
    currentServiceHours: Math.round((currentServiceMinutes / 60) * 10) / 10,
    workloadLabel,
    workloadLabelDisplay: workloadLabelDisplay(workloadLabel),
    routeOptimizationStatus,
    workloadPenalty: penalty,
    isHeavy,
    durationFallbackCount: fallbackCount,
    durationWarnings: warnings,
    enrichedStops,
  };
}

/**
 * After ranking, prefer a lighter route when the top pick is heavy and a close alternative exists.
 * @param {Array<Object>} scored
 */
export function applyLighterRoutePreference(scored, cfg = ROUTE_WORKLOAD_CONFIG) {
  if (!cfg.allowHeavyRouteFallback || scored.length < 2) return scored;

  const sorted = [...scored].sort((a, b) => (b.scores?.total ?? 0) - (a.scores?.total ?? 0));
  const top = sorted[0];
  if (!top?.workload?.isHeavy) return sorted;

  const challenger = sorted.find((m, i) => {
    if (i === 0) return false;
    const gap = (top.scores?.total ?? 0) - (m.scores?.total ?? 0);
    return (
      (m.workload?.stopCount ?? 99) < cfg.lighterRouteMaxStops &&
      gap <= cfg.lighterRouteScoreGap &&
      m.bestInsertion?.viable !== false
    );
  });

  if (!challenger) return sorted;

  challenger.dispatcherNote =
    'Although another route is slightly closer, this technician has a lighter workload and can absorb the appointment better.';
  challenger.chosenDespiteHeavierAlternative = false;
  top.skippedBecauseHeavy = true;
  top.dispatcherNote =
    `A lighter route was preferred even though ${top.techName} is geographically closer.`;

  return [challenger, top, ...sorted.filter(m => m !== challenger && m !== top)];
}
