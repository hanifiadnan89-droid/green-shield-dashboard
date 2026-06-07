/**
 * Route area viability — determines whether a technician's route practically
 * fits the new appointment geography (not just nearest-stop distance).
 */

import { haversineMiles } from './routeTravelTimeProvider.js';
import { ROUTE_AREA_VIABILITY_DEFAULTS } from './routeAreaViabilityConfig.js';

function round1(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

export function computeRouteCentroid(stops = []) {
  const valid = stops.filter(s => s?.lat != null && s?.lng != null);
  if (!valid.length) return null;
  return {
    lat: valid.reduce((sum, s) => sum + Number(s.lat), 0) / valid.length,
    lng: valid.reduce((sum, s) => sum + Number(s.lng), 0) / valid.length,
  };
}

/** Approximate shortest distance from a point to a lat/lng segment (miles). */
export function distancePointToSegmentMiles(lat, lng, a, b) {
  if (!a?.lat || !b?.lat) return Infinity;
  const steps = [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1];
  let min = Infinity;
  for (const t of steps) {
    const plat = a.lat + t * (b.lat - a.lat);
    const plng = a.lng + t * (b.lng - a.lng);
    min = Math.min(min, haversineMiles(lat, lng, plat, plng));
  }
  return min;
}

export function computeCorridorDistanceMiles(leadLat, leadLng, pathPoints = []) {
  if (!pathPoints.length) return Infinity;
  if (pathPoints.length === 1) {
    return haversineMiles(leadLat, leadLng, pathPoints[0].lat, pathPoints[0].lng);
  }
  let min = Infinity;
  for (let i = 0; i < pathPoints.length - 1; i++) {
    min = Math.min(
      min,
      distancePointToSegmentMiles(leadLat, leadLng, pathPoints[i], pathPoints[i + 1]),
    );
  }
  return min;
}

export function classifyCorridorFit(distanceMiles, cfg = ROUTE_AREA_VIABILITY_DEFAULTS) {
  if (distanceMiles <= cfg.corridorOnRouteMiles) return 'on_route';
  if (distanceMiles <= cfg.corridorNearRouteMiles) return 'near_route';
  if (distanceMiles <= cfg.corridorOffRouteMiles) return 'off_route';
  return 'far_off_route';
}

function resolveHomeLocations(tech, cfg) {
  const start = tech?.startLocation?.lat != null ? tech.startLocation : null;
  let end = tech?.endLocation?.lat != null ? tech.endLocation : null;
  if (!end && start) end = start;
  const sameHome = start && end
    && haversineMiles(start.lat, start.lng, end.lat, end.lng) <= cfg.sameHomeLocationMiles;
  return { start, end, sameHome };
}

export function assessAreaViability({
  tech,
  lead,
  stops = [],
  insertion = null,
  cfg = ROUTE_AREA_VIABILITY_DEFAULTS,
}) {
  const leadLat = lead?.lat;
  const leadLng = lead?.lng;
  const validStops = stops.filter(s => s?.lat != null && s?.lng != null);
  const { start, end, sameHome } = resolveHomeLocations(tech, cfg);

  const nearestStopMiles = validStops.length
    ? Math.min(...validStops.map(s => haversineMiles(leadLat, leadLng, s.lat, s.lng)))
    : Infinity;

  const centroid = computeRouteCentroid(validStops);
  const routeCentroidMiles = centroid
    ? haversineMiles(leadLat, leadLng, centroid.lat, centroid.lng)
    : Infinity;

  const startHomeMiles = start
    ? haversineMiles(leadLat, leadLng, start.lat, start.lng)
    : null;
  const endHomeMiles = end
    ? haversineMiles(leadLat, leadLng, end.lat, end.lng)
    : null;

  const pathPoints = [];
  if (start) pathPoints.push({ lat: start.lat, lng: start.lng });
  for (const s of validStops) pathPoints.push({ lat: s.lat, lng: s.lng });
  if (end && !sameHome) pathPoints.push({ lat: end.lat, lng: end.lng });

  const corridorDistanceMiles = computeCorridorDistanceMiles(leadLat, leadLng, pathPoints);
  const corridorFit = classifyCorridorFit(corridorDistanceMiles, cfg);

  const addedDriveMinutes = insertion?.addedDriveMinutes ?? 0;
  const backtrackingRisk = insertion?.backtrackingRisk ?? 'None';

  let areaViability = 'acceptable';
  let outOfAreaReason = null;
  let areaViabilityScore = 72;

  const farFromCentroid = routeCentroidMiles > cfg.outOfAreaRadiusMiles;
  const farFromNearest = nearestStopMiles > cfg.outOfAreaRadiusMiles;
  const farFromStartHome = startHomeMiles != null && startHomeMiles > cfg.outOfAreaRadiusMiles;

  const classicOutOfArea = farFromCentroid && farFromNearest && (startHomeMiles == null || farFromStartHome);

  const deceptiveNearestStop = nearestStopMiles <= cfg.maxNearestStopMilesForNormalRecommendation
    && routeCentroidMiles > cfg.maxCentroidToJobMiles
    && (corridorFit === 'off_route' || corridorFit === 'far_off_route');

  const homeMismatch = startHomeMiles != null
    && startHomeMiles > cfg.maxHomeToJobMilesWithoutRouteFit
    && routeCentroidMiles > cfg.maxCentroidToJobMiles;

  if (classicOutOfArea || deceptiveNearestStop || homeMismatch) {
    areaViability = 'out_of_area';
    areaViabilityScore = 8;
    if (classicOutOfArea) {
      outOfAreaReason = 'Job is far from the route cluster, corridor, and technician home area.';
    } else if (deceptiveNearestStop) {
      outOfAreaReason = 'One stop is nearby but the route operates in a different area.';
    } else {
      outOfAreaReason = 'Technician home and route are far from this appointment.';
    }
  } else if (
    routeCentroidMiles > cfg.weakAreaRadiusMiles
    || corridorFit === 'far_off_route'
    || addedDriveMinutes > cfg.maxAddedDriveMinutesNormal
    || backtrackingRisk === 'Severe'
    || backtrackingRisk === 'High'
  ) {
    areaViability = 'weak';
    areaViabilityScore = 38;
    outOfAreaReason = outOfAreaReason || 'Route fit is marginal for this appointment location.';
  } else if (
    nearestStopMiles <= cfg.strongAreaRadiusMiles
    && routeCentroidMiles <= cfg.acceptableAreaRadiusMiles
    && (corridorFit === 'on_route' || corridorFit === 'near_route')
    && (startHomeMiles == null || startHomeMiles <= cfg.acceptableAreaRadiusMiles)
  ) {
    areaViability = 'strong';
    areaViabilityScore = 92;
  } else if (
    nearestStopMiles <= cfg.acceptableAreaRadiusMiles
    && routeCentroidMiles <= cfg.maxCentroidToJobMiles
  ) {
    areaViability = 'acceptable';
    areaViabilityScore = 68;
  } else {
    areaViability = 'weak';
    areaViabilityScore = 42;
    outOfAreaReason = outOfAreaReason || 'Route is outside the preferred service area for this job.';
  }

  return {
    areaViability,
    areaViabilityScore,
    outOfAreaReason,
    nearestStopMiles: round1(nearestStopMiles),
    routeCentroidMiles: round1(routeCentroidMiles),
    startHomeMiles: round1(startHomeMiles),
    endHomeMiles: round1(endHomeMiles),
    corridorDistanceMiles: round1(corridorDistanceMiles),
    corridorFit,
    shouldSuppressFromTopResults: areaViability === 'out_of_area',
    missingStartLocation: !start,
    missingEndLocation: !tech?.endLocation?.lat && !sameHome,
  };
}

export function getAreaViabilityScoreAdjustments(viability, cfg = ROUTE_AREA_VIABILITY_DEFAULTS) {
  let bonus = 0;
  let penalty = 0;

  if (viability.areaViability === 'strong') bonus += cfg.scoreBonusStrong;
  else if (viability.areaViability === 'acceptable') bonus += cfg.scoreBonusAcceptable;
  else if (viability.areaViability === 'weak') penalty += cfg.scorePenaltyWeak;
  else if (viability.areaViability === 'out_of_area') penalty += cfg.scorePenaltyOutOfArea;

  bonus += cfg.corridorBonus[viability.corridorFit] ?? 0;

  return { bonus, penalty };
}

function areaViabilityRank(v) {
  const order = { strong: 0, acceptable: 1, weak: 2, out_of_area: 3 };
  return order[v?.areaViability] ?? 2;
}

function compareRoutesForRanking(a, b) {
  const areaDiff = areaViabilityRank(a.areaViability) - areaViabilityRank(b.areaViability);
  if (areaDiff !== 0) return areaDiff;

  const scoreDiff = (b.scores?.total ?? 0) - (a.scores?.total ?? 0);
  if (scoreDiff !== 0) return scoreDiff;

  const centroidDiff = (a.areaViability?.routeCentroidMiles ?? Infinity)
    - (b.areaViability?.routeCentroidMiles ?? Infinity);
  if (centroidDiff !== 0) return centroidDiff;

  return (a.areaViability?.nearestStopMiles ?? Infinity)
    - (b.areaViability?.nearestStopMiles ?? Infinity);
}

/**
 * Build top-N recommendations respecting area viability tiers.
 * Out-of-area routes appear only when no better tier fills the slots.
 */
export function selectTopMatchesByAreaViability(scored = [], topN = 3) {
  const sorted = [...scored].sort(compareRoutesForRanking);

  const strong = sorted.filter(r => r.areaViability?.areaViability === 'strong');
  const acceptable = sorted.filter(r => r.areaViability?.areaViability === 'acceptable');
  const weak = sorted.filter(r => r.areaViability?.areaViability === 'weak');
  const outOfArea = sorted.filter(r => r.areaViability?.areaViability === 'out_of_area');

  let pool = [...strong, ...acceptable];
  if (pool.length < topN) {
    const weakOnly = weak.filter(w => !pool.some(p => p.routeId === w.routeId));
    pool = [...pool, ...weakOnly];
  }

  if (pool.length === 0) {
    pool = outOfArea.map(markAreaFallback).slice(0, topN);
  }

  pool.sort(compareRoutesForRanking);
  return pool.slice(0, topN).map((match, i) => ({ ...match, rank: i + 1 }));
}

export function markAreaFallback(match) {
  if (match.areaFallbackOnly) return match;
  const label = 'Fallback only — outside normal route area.';
  return {
    ...match,
    areaFallbackOnly: true,
    areaFallbackLabel: label,
    reason: match.reason
      ? `${match.reason} ${label}`
      : label,
  };
}
