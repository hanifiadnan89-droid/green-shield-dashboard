import {
  getCachedPair,
  setCachedPair,
  getCachedRouteMatrix,
  setCachedRouteMatrix,
  pairCacheKey,
  routeCacheKey,
} from './routeMatrixCache.js';
const ROUTES_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const EARTH_RADIUS_MI = 3958.8;

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
const MAX_ELEMENTS_PER_REQUEST = 100;
const METERS_PER_MILE = 1609.344;

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

/**
 * Compute legs for an array of origin/destination pairs with caching and batching.
 */
export async function computeTravelLegs({
  legs = [],
  context = {},
  trafficAware = false,
} = {}) {
  const diagnostics = {
    matrixProvider: 'haversine',
    cacheHit: false,
    elementsRequested: legs.length,
    estimatedApiCostCategory: legs.length <= 25 ? 'low' : legs.length <= 100 ? 'medium' : 'high',
    fallbackUsed: false,
    cacheHits: 0,
    cacheMisses: 0,
  };

  const routeKey = context.date && context.routeId
    ? routeCacheKey({ date: context.date, routeId: context.routeId, trafficAware })
    : null;

  if (routeKey) {
    const cachedRoute = getCachedRouteMatrix(routeKey);
    if (cachedRoute?.legs?.length === legs.length) {
      diagnostics.matrixProvider = cachedRoute.provider || 'google-routes';
      diagnostics.cacheHit = true;
      diagnostics.fallbackUsed = cachedRoute.fallbackUsed || false;
      return { legs: cachedRoute.legs, diagnostics };
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

    const cached = getCachedPair(origin, destination);
    if (cached?.distanceMiles != null) {
      results[index] = cached;
      diagnostics.cacheHits += 1;
      return;
    }

    missing.push({ index, origin, destination });
  });

  if (missing.length === 0 && results.every(Boolean)) {
    diagnostics.matrixProvider = results[0]?.provider || 'haversine';
    diagnostics.cacheHit = diagnostics.cacheHits > 0;
    return { legs: results, diagnostics };
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey || missing.length === 0) {
    for (const item of missing) {
      const fallback = haversineLeg(item.origin, item.destination);
      results[item.index] = fallback;
      setCachedPair(item.origin, item.destination, fallback);
      diagnostics.fallbackUsed = true;
    }
    diagnostics.matrixProvider = 'haversine';
    return { legs: results, diagnostics };
  }

  try {
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
    if (elements > MAX_ELEMENTS_PER_REQUEST) {
      throw new Error(`Matrix element count ${elements} exceeds safe limit ${MAX_ELEMENTS_PER_REQUEST}`);
    }

    diagnostics.elementsRequested = elements;
    const matrix = await callGoogleRouteMatrix(uniqueOrigins, uniqueDestinations, { trafficAware });
    const rows = Array.isArray(matrix) ? matrix : matrix?.elements || [];

    for (const item of missing) {
      const oi = originIndex.get(pointIndexKey(item.origin));
      const di = destIndex.get(pointIndexKey(item.destination));
      const cell = rows.find(r => r.originIndex === oi && r.destinationIndex === di);
      let leg;
      if (cell?.distanceMeters != null && cell?.duration != null && cell.status !== 'ROUTE_NOT_FOUND') {
        leg = {
          distanceMiles: Math.round((cell.distanceMeters / METERS_PER_MILE) * 100) / 100,
          travelMinutes: Math.round(parseGoogleDurationSeconds(cell.duration) / 60),
          provider: 'google-routes',
          accuracy: 'road-based',
          trafficAware,
          warnings: [],
        };
        diagnostics.matrixProvider = 'google-routes';
      } else {
        leg = haversineLeg(item.origin, item.destination);
        diagnostics.fallbackUsed = true;
      }
      results[item.index] = leg;
      setCachedPair(item.origin, item.destination, leg);
      diagnostics.cacheMisses += 1;
    }
  } catch (err) {
    console.warn('[google-routes] matrix fallback:', err.message);
    for (const item of missing) {
      const fallback = haversineLeg(item.origin, item.destination);
      results[item.index] = fallback;
      setCachedPair(item.origin, item.destination, fallback);
      diagnostics.fallbackUsed = true;
    }
    diagnostics.matrixProvider = 'haversine';
  }

  if (routeKey) {
    setCachedRouteMatrix(routeKey, {
      legs: results,
      provider: diagnostics.matrixProvider,
      fallbackUsed: diagnostics.fallbackUsed,
    });
  }

  diagnostics.cacheHit = diagnostics.cacheHits > 0 && diagnostics.cacheMisses === 0;
  return { legs: results, diagnostics };
}

export function getGoogleRoutesStatus() {
  return {
    configured: Boolean(process.env.GOOGLE_ROUTES_API_KEY),
    provider: process.env.GOOGLE_ROUTES_API_KEY ? 'google-routes' : 'haversine',
  };
}
