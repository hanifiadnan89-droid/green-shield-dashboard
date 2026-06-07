import { getRoutesApiConfig } from './routesApiConfig.js';

function pointKey(point) {
  if (!point?.lat || !point?.lng) return null;
  return `${Number(point.lat).toFixed(5)},${Number(point.lng).toFixed(5)}`;
}

/** Billable matrix size for a set of leg pairs (origins × destinations). */
export function estimateMatrixElements(legs = []) {
  const origins = new Set();
  const destinations = new Set();
  for (const leg of legs) {
    const o = pointKey(leg.origin);
    const d = pointKey(leg.destination);
    if (o) origins.add(o);
    if (d) destinations.add(d);
  }
  return origins.size * destinations.size;
}

/** Unique directed leg pairs (pairwise billing = 1 element per leg). */
export function countUniqueLegs(legs = []) {
  const seen = new Set();
  let count = 0;
  for (const leg of legs) {
    const o = pointKey(leg.origin);
    const d = pointKey(leg.destination);
    if (!o || !d) continue;
    const key = `${o}->${d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
  }
  return count;
}

/**
 * Estimated billable elements for a leg set, matching server batch vs pairwise choice.
 */
export function estimateBilledElements(legs = [], options = {}) {
  const config = getRoutesApiConfig();
  const maxElementsPerRoute = options.maxElementsPerRoute ?? config.maxElementsPerRoute;
  const matrixElements = estimateMatrixElements(legs);
  const uniqueLegs = countUniqueLegs(legs);

  if (matrixElements > maxElementsPerRoute) {
    return uniqueLegs;
  }
  return matrixElements;
}

export function createRouteBudget(context = {}) {
  const config = getRoutesApiConfig();
  const incoming = context.budget || {};
  return {
    enableRoadTiming: context.enableRoadTiming ?? config.enableRoadTiming,
    maxElementsPerSearch: incoming.maxElementsPerSearch ?? config.maxElementsPerSearch,
    maxElementsPerRoute: incoming.maxElementsPerRoute ?? config.maxElementsPerRoute,
    remainingSearchElements: incoming.remainingSearchElements ?? config.maxElementsPerSearch,
    elementsRequested: incoming.elementsRequested ?? 0,
    elementsFromCache: incoming.elementsFromCache ?? 0,
    elementsSavedByCache: incoming.elementsSavedByCache ?? 0,
    routesRoadScored: incoming.routesRoadScored ?? 0,
    routesEstimatedOnly: incoming.routesEstimatedOnly ?? 0,
    routeId: context.routeId ?? null,
  };
}

/**
 * Decide whether a matrix call is allowed and how many elements it would bill.
 * @returns {{ allowed: boolean, elements: number, reason?: string }}
 */
export function assessMatrixRequest(legs, budget) {
  const config = getRoutesApiConfig();
  const elements = estimateMatrixElements(legs);

  if (!budget.enableRoadTiming) {
    return { allowed: false, elements, reason: 'road_timing_disabled' };
  }

  if (elements > config.maxMatrixElementsPerRequest) {
    return { allowed: false, elements, reason: 'matrix_batch_too_large' };
  }

  if (elements > budget.maxElementsPerRoute) {
    return { allowed: false, elements, reason: 'route_element_budget' };
  }

  if (elements > budget.remainingSearchElements) {
    return { allowed: false, elements, reason: 'search_element_budget' };
  }

  return { allowed: true, elements };
}

export function consumeBudgetElements(budget, billedElements, { fromCache = 0 } = {}) {
  if (fromCache > 0) {
    budget.elementsFromCache += fromCache;
    budget.elementsSavedByCache += fromCache;
  }
  if (billedElements > 0) {
    budget.elementsRequested += billedElements;
    budget.remainingSearchElements = Math.max(0, budget.remainingSearchElements - billedElements);
  }
}

export function budgetDiagnostics(budget, extra = {}) {
  return {
    elementsRequested: budget.elementsRequested,
    elementsFromCache: budget.elementsFromCache,
    elementsSavedByCache: budget.elementsSavedByCache,
    elementsBudgetRemaining: budget.remainingSearchElements,
    routesRoadScored: budget.routesRoadScored,
    routesEstimatedOnly: budget.routesEstimatedOnly,
    ...extra,
  };
}
