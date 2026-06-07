import {
  getCachedPair,
  setCachedPair,
  getCachedRouteMatrix,
  setCachedRouteMatrix,
  routeCacheKey,
  getOrComputePair,
} from './routeMatrixCache.js';
import { getRoutesApiConfig } from './routesApiConfig.js';
import {
  createRouteBudget,
  assessMatrixRequest,
  consumeBudgetElements,
  budgetDiagnostics,
  estimateMatrixElements,
} from './routesApiBudget.js';

const ROUTES_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const EARTH_RADIUS_MI = 3958.8;
const METERS_PER_MILE = 1609.344;

function haversineMiles(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function travelMinutesFromMiles(miles) {
  if (!miles || miles <= 0) return 0;
  const mph = miles < 2 ? 22 : miles < 8 ? 30 : 45;
  return (miles / mph) * 60;
}

function normalizePoint(point) {
  if (!point || point.lat == null || point.lng == null) return null;
  return { lat: Number(point.lat), lng: Number(point.lng) };
}

function haversineLeg(origin, destination) {
  const a = normalizePoint(origin);
  const b = normalizePoint(destination);
  if (!a || !b) {
    return {
      distanceMiles: 0,
      travelMinutes: 0,
      provider: 'haversine',
      accuracy: 'estimated',
      trafficAware: false,
      warnings: ['Missing coordinates for distance calculation'],
    };
  }
  const distanceMiles = haversineMiles(a.lat, a.lng, b.lat, b.lng);
  return {
    distanceMiles,
    travelMinutes: travelMinutesFromMiles(distanceMiles),
    provider: 'haversine',
    accuracy: 'estimated',
    trafficAware: false,
    warnings: ['Road-based drive time unavailable; using estimated straight-line distance.'],
  };
}

function parseGoogleDurationSeconds(duration) {
  if (!duration) return 0;
  if (typeof duration === 'string' && duration.endsWith('s')) {
    return parseFloat(duration) || 0;
  }
  if (typeof duration === 'object' && duration.seconds != null) {
    return Number(duration.seconds) || 0;
  }
  return 0;
}

function legFromMatrixCell(cell, trafficAware) {
  if (cell?.distanceMeters != null && cell?.duration != null && cell.status !== 'ROUTE_NOT_FOUND') {
    return {
      distanceMiles: Math.round((cell.distanceMeters / METERS_PER_MILE) * 100) / 100,
      travelMinutes: Math.round(parseGoogleDurationSeconds(cell.duration) / 60),
      provider: 'google-routes',
      accuracy: 'road-based',
      trafficAware,
      warnings: [],
    };
  }
  return null;
}

async function callGoogleRouteMatrix(origins, destinations, { trafficAware = false } = {}) {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_ROUTES_API_KEY is not configured');
  }

  const body = {
    origins: origins.map(p => ({
      waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
    })),
    destinations: destinations.map(p => ({
      waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
    })),
    travelMode: 'DRIVE',
    routingPreference: trafficAware ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE',
  };

  const res = await fetch(ROUTES_MATRIX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Google Routes API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function fetchGooglePair(origin, destination, trafficAware) {
  const matrix = await callGoogleRouteMatrix([origin], [destination], { trafficAware });
  const rows = Array.isArray(matrix) ? matrix : matrix?.elements || [];
  const cell = rows.find(r => r.originIndex === 0 && r.destinationIndex === 0);
  const leg = legFromMatrixCell(cell, trafficAware);
  if (leg) return leg;
  return haversineLeg(origin, destination);
}

function applyFallbackLeg(item, leg, diagnostics, trafficAware, reason = null) {
  item.resultsRef[item.index] = leg;
  setCachedPair(item.origin, item.destination, leg, { trafficAware });
  if (leg.provider === 'haversine') {
    diagnostics.fallbackUsed = true;
    if (reason) diagnostics.fallbackReason = reason;
  }
}

async function resolveMissingLegsPairwise(missing, budget, trafficAware, diagnostics) {
  diagnostics.pairwiseMode = true;

  for (const item of missing) {
    if (budget.remainingSearchElements <= 0) {
      applyFallbackLeg(
        item,
        haversineLeg(item.origin, item.destination),
        diagnostics,
        trafficAware,
        'search_element_budget',
      );
      continue;
    }

    try {
      const { result, fromCache } = await getOrComputePair(
        item.origin,
        item.destination,
        { trafficAware },
        () => fetchGooglePair(item.origin, item.destination, trafficAware),
      );

      item.resultsRef[item.index] = result;
      if (fromCache) {
        consumeBudgetElements(budget, 0, { fromCache: 1 });
        diagnostics.cacheHits += 1;
        if (result.provider === 'google-routes') {
          diagnostics.matrixProvider = 'google-routes';
          diagnostics.travelProvider = 'google-routes';
          diagnostics.travelAccuracy = 'road-based';
        }
      } else if (result.provider === 'google-routes') {
        consumeBudgetElements(budget, 1);
        diagnostics.cacheMisses += 1;
        diagnostics.matrixProvider = 'google-routes';
        diagnostics.travelProvider = 'google-routes';
        diagnostics.travelAccuracy = 'road-based';
      } else {
        diagnostics.fallbackUsed = true;
      }
    } catch (err) {
      console.warn('[google-routes] pairwise fallback:', err.message);
      applyFallbackLeg(
        item,
        haversineLeg(item.origin, item.destination),
        diagnostics,
        trafficAware,
        'api_error',
      );
    }
  }
}

async function resolveWithBatchMatrix(missing, budget, trafficAware, diagnostics) {
  const uniqueOrigins = [];
  const uniqueDestinations = [];
  const originIndex = new Map();
  const destIndex = new Map();
  const pointIndexKey = p => `${p.lat}|${p.lng}`;

  for (const item of missing) {
    const oKey = pointIndexKey(item.origin);
    const dKey = pointIndexKey(item.destination);
    if (!originIndex.has(oKey)) {
      originIndex.set(oKey, uniqueOrigins.length);
      uniqueOrigins.push(item.origin);
    }
    if (!destIndex.has(dKey)) {
      destIndex.set(dKey, uniqueDestinations.length);
      uniqueDestinations.push(item.destination);
    }
  }

  const elements = uniqueOrigins.length * uniqueDestinations.length;
  diagnostics.elementsRequested = (diagnostics.elementsRequested || 0) + elements;
  diagnostics.matrixElementsRequested = diagnostics.elementsRequested;

  const matrix = await callGoogleRouteMatrix(uniqueOrigins, uniqueDestinations, { trafficAware });
  consumeBudgetElements(budget, elements);
  const rows = Array.isArray(matrix) ? matrix : matrix?.elements || [];

  for (const item of missing) {
    const oi = originIndex.get(pointIndexKey(item.origin));
    const di = destIndex.get(pointIndexKey(item.destination));
    const cell = rows.find(r => r.originIndex === oi && r.destinationIndex === di);
    const leg = legFromMatrixCell(cell, trafficAware) || haversineLeg(item.origin, item.destination);
    item.resultsRef[item.index] = leg;
    setCachedPair(item.origin, item.destination, leg, { trafficAware });
    diagnostics.cacheMisses += 1;
    if (leg.provider === 'google-routes') {
      diagnostics.matrixProvider = 'google-routes';
      diagnostics.travelProvider = 'google-routes';
      diagnostics.travelAccuracy = 'road-based';
    } else {
      diagnostics.fallbackUsed = true;
      diagnostics.fallbackReason = 'route_not_found';
    }
  }
}

/**
 * Compute legs for an array of origin/destination pairs with caching, batching, and budgets.
 */
export async function computeTravelLegs({
  legs = [],
  context = {},
  trafficAware = false,
} = {}) {
  const budget = createRouteBudget(context);
  const config = getRoutesApiConfig();

  const diagnostics = {
    matrixProvider: 'haversine',
    travelProvider: 'haversine',
    travelAccuracy: 'estimated',
    roadTimingUsed: false,
    cacheHit: false,
    elementsRequested: 0,
    matrixElementsRequested: 0,
    elementsFromCache: 0,
    elementsSavedByCache: 0,
    elementsBudgetRemaining: budget.remainingSearchElements,
    estimatedApiCostCategory: legs.length <= 25 ? 'low' : legs.length <= 100 ? 'medium' : 'high',
    fallbackUsed: false,
    fallbackReason: null,
    cacheHits: 0,
    cacheMisses: 0,
    routesRoadScored: budget.routesRoadScored,
    routesEstimatedOnly: budget.routesEstimatedOnly,
    trafficAware,
    targetedMode: Boolean(context.targetedMode),
    pairwiseMode: false,
  };

  if (!config.enableRoadTiming || !budget.enableRoadTiming) {
    diagnostics.fallbackReason = 'road_timing_disabled';
    diagnostics.fallbackUsed = true;
    return {
      legs: legs.map(leg => haversineLeg(leg.origin, leg.destination)),
      diagnostics: { ...diagnostics, ...budgetDiagnostics(budget) },
      budget: budgetDiagnostics(budget),
    };
  }

  const routeKey = context.date && context.routeId
    ? routeCacheKey({ date: context.date, routeId: context.routeId, trafficAware })
    : null;

  if (routeKey) {
    const cachedRoute = getCachedRouteMatrix(routeKey);
    if (cachedRoute?.legs?.length === legs.length) {
      diagnostics.matrixProvider = cachedRoute.provider || 'google-routes';
      diagnostics.travelProvider = diagnostics.matrixProvider;
      diagnostics.travelAccuracy = diagnostics.matrixProvider === 'google-routes' ? 'road-based' : 'estimated';
      diagnostics.roadTimingUsed = diagnostics.matrixProvider === 'google-routes';
      diagnostics.cacheHit = true;
      diagnostics.fallbackUsed = cachedRoute.fallbackUsed || false;
      diagnostics.fallbackReason = cachedRoute.fallbackReason || null;
      return {
        legs: cachedRoute.legs,
        diagnostics: { ...diagnostics, ...budgetDiagnostics(budget) },
        budget: budgetDiagnostics(budget),
      };
    }
  }

  const results = new Array(legs.length).fill(null);
  const missing = [];

  legs.forEach((leg, index) => {
    const origin = normalizePoint(leg.origin);
    const destination = normalizePoint(leg.destination);
    if (!origin || !destination) {
      results[index] = haversineLeg(origin, destination);
      return;
    }

    const cached = getCachedPair(origin, destination, { trafficAware });
    if (cached?.distanceMiles != null) {
      results[index] = cached;
      diagnostics.cacheHits += 1;
      diagnostics.elementsFromCache += 1;
      diagnostics.elementsSavedByCache += 1;
      if (cached.provider === 'google-routes') {
        diagnostics.matrixProvider = 'google-routes';
        diagnostics.travelProvider = 'google-routes';
        diagnostics.travelAccuracy = 'road-based';
        diagnostics.roadTimingUsed = true;
      }
      return;
    }

    missing.push({ index, origin, destination, resultsRef: results });
  });

  if (missing.length === 0 && results.every(Boolean)) {
    diagnostics.fallbackUsed = diagnostics.matrixProvider === 'haversine';
    diagnostics.cacheHit = diagnostics.cacheHits > 0;
    diagnostics.elementsBudgetRemaining = budget.remainingSearchElements;
    return {
      legs: results,
      diagnostics: { ...diagnostics, ...budgetDiagnostics(budget) },
      budget: budgetDiagnostics(budget),
    };
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) {
    for (const item of missing) {
      results[item.index] = haversineLeg(item.origin, item.destination);
      setCachedPair(item.origin, item.destination, results[item.index], { trafficAware });
    }
    diagnostics.fallbackUsed = true;
    diagnostics.fallbackReason = 'missing_api_key';
    return {
      legs: results,
      diagnostics: { ...diagnostics, ...budgetDiagnostics(budget) },
      budget: budgetDiagnostics(budget),
    };
  }

  const perRouteElements = estimateMatrixElements(missing);
  if (perRouteElements > budget.maxElementsPerRoute) {
    diagnostics.pairwiseMode = true;
    diagnostics.fallbackReason = diagnostics.fallbackReason || 'route_element_budget';
  }

  try {
    const assessment = assessMatrixRequest(missing, budget);
    if (assessment.allowed) {
      await resolveWithBatchMatrix(missing, budget, trafficAware, diagnostics);
    } else {
      await resolveMissingLegsPairwise(missing, budget, trafficAware, diagnostics);
    }
  } catch (err) {
    console.warn('[google-routes] matrix fallback:', err.message);
    for (const item of missing) {
      const fallback = haversineLeg(item.origin, item.destination);
      results[item.index] = fallback;
      setCachedPair(item.origin, item.destination, fallback, { trafficAware });
    }
    diagnostics.fallbackUsed = true;
    diagnostics.fallbackReason = diagnostics.fallbackReason || 'api_error';
  }

  if (routeKey) {
    setCachedRouteMatrix(routeKey, {
      legs: results,
      provider: diagnostics.matrixProvider,
      fallbackUsed: diagnostics.fallbackUsed,
      fallbackReason: diagnostics.fallbackReason,
    });
  }

  diagnostics.roadTimingUsed = diagnostics.matrixProvider === 'google-routes' && !diagnostics.fallbackUsed;
  diagnostics.cacheHit = diagnostics.cacheHits > 0 && diagnostics.cacheMisses === 0;
  diagnostics.elementsBudgetRemaining = budget.remainingSearchElements;
  diagnostics.matrixElementsRequested = diagnostics.elementsRequested;

  if (diagnostics.fallbackUsed && !diagnostics.fallbackReason) {
    diagnostics.fallbackReason = 'haversine_fallback';
  }

  if (diagnostics.fallbackUsed && diagnostics.fallbackReason?.includes('budget')) {
    diagnostics.fallbackReason = 'Road timing skipped to control API usage; estimated timing used.';
  }

  return {
    legs: results,
    diagnostics: { ...diagnostics, ...budgetDiagnostics(budget) },
    budget: budgetDiagnostics(budget),
  };
}

export function getGoogleRoutesStatus() {
  const config = getRoutesApiConfig();
  return {
    configured: Boolean(process.env.GOOGLE_ROUTES_API_KEY),
    provider: process.env.GOOGLE_ROUTES_API_KEY ? 'google-routes' : 'haversine',
    ...config,
  };
}
