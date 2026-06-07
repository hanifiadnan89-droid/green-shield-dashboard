import {
  getCachedPolyline,
  setCachedPolyline,
  polylineCacheKey,
} from './routeMatrixCache.js';

const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
/** Google allows up to 25 intermediates; keep margin for safety. */
const MAX_INTERMEDIATES_PER_REQUEST = 23;

function normalizeStop(stop) {
  if (!stop || stop.lat == null || stop.lng == null) return null;
  const lat = Number(stop.lat);
  const lng = Number(stop.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, stopId: stop.stopId || stop.id || null, label: stop.label || null };
}

function waypoint(point) {
  return { location: { latLng: { latitude: point.lat, longitude: point.lng } } };
}

function parseDurationSeconds(duration) {
  if (!duration) return 0;
  if (typeof duration === 'string' && duration.endsWith('s')) return parseFloat(duration) || 0;
  if (typeof duration === 'object' && duration.seconds != null) return Number(duration.seconds) || 0;
  return 0;
}

async function callComputeRoutes(origin, destination, intermediates, { trafficAware = false } = {}) {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_ROUTES_API_KEY is not configured');

  const body = {
    origin: waypoint(origin),
    destination: waypoint(destination),
    travelMode: 'DRIVE',
    routingPreference: trafficAware ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
  };

  if (intermediates.length > 0) {
    body.intermediates = intermediates.map(waypoint);
  }

  const res = await fetch(COMPUTE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Google computeRoutes HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route?.polyline?.encodedPolyline) {
    throw new Error('Google computeRoutes returned no encoded polyline');
  }

  return {
    encodedPolyline: route.polyline.encodedPolyline,
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: parseDurationSeconds(route.duration),
    legs: (route.legs || []).map((leg, i) => ({
      index: i,
      distanceMeters: leg.distanceMeters ?? 0,
      durationSeconds: parseDurationSeconds(leg.duration),
    })),
  };
}

/**
 * Compute a road-following encoded polyline for ordered stops.
 * Splits into segments when waypoint count exceeds API limits.
 */
export async function computeRoadPolyline({
  stops = [],
  context = {},
  trafficAware = false,
} = {}) {
  const normalized = stops.map(normalizeStop).filter(Boolean);
  const stopIds = normalized.map((s, i) => s.stopId || `idx-${i}`);
  const cacheKey = polylineCacheKey({
    date: context.date,
    routeId: context.routeId,
    stopIds,
    trafficAware,
  });

  const cached = getCachedPolyline(cacheKey);
  if (cached?.encodedPolyline) {
    return {
      ...cached,
      provider: cached.provider || 'google-routes',
      cacheHit: true,
      warnings: cached.warnings || [],
    };
  }

  if (normalized.length < 2) {
    return {
      provider: 'straight-line',
      encodedPolyline: null,
      distanceMeters: 0,
      durationSeconds: 0,
      legs: [],
      cacheHit: false,
      fallbackUsed: true,
      fallbackReason: 'insufficient_stops',
      warnings: ['Need at least two stops to compute a road route.'],
    };
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) {
    return {
      provider: 'straight-line',
      encodedPolyline: null,
      distanceMeters: 0,
      durationSeconds: 0,
      legs: [],
      cacheHit: false,
      fallbackUsed: true,
      fallbackReason: 'missing_api_key',
      warnings: ['Road-following map path unavailable — GOOGLE_ROUTES_API_KEY is not configured.'],
    };
  }

  try {
    const encodedPolylines = [];
    let totalDistance = 0;
    let totalDuration = 0;
    const legs = [];

    for (let start = 0; start < normalized.length - 1;) {
      const end = Math.min(
        normalized.length - 1,
        start + MAX_INTERMEDIATES_PER_REQUEST + 1,
      );
      const chunk = normalized.slice(start, end + 1);
      const origin = chunk[0];
      const destination = chunk[chunk.length - 1];
      const intermediates = chunk.slice(1, -1);

      const segment = await callComputeRoutes(origin, destination, intermediates, { trafficAware });
      encodedPolylines.push(segment.encodedPolyline);
      totalDistance += segment.distanceMeters;
      totalDuration += segment.durationSeconds;
      legs.push(...segment.legs.map(leg => ({ ...leg, segmentStart: start })));

      start = end;
    }

    const payload = {
      provider: 'google-routes',
      encodedPolyline: encodedPolylines.length === 1 ? encodedPolylines[0] : encodedPolylines,
      distanceMeters: totalDistance,
      durationSeconds: totalDuration,
      legs,
      cacheHit: false,
      fallbackUsed: false,
      fallbackReason: null,
      warnings: encodedPolylines.length > 1
        ? ['Route was split into multiple road segments due to waypoint limits.']
        : [],
    };

    setCachedPolyline(cacheKey, payload);
    return payload;
  } catch (err) {
    console.warn('[google-routes] computeRoutes fallback:', err.message);
    return {
      provider: 'straight-line',
      encodedPolyline: null,
      distanceMeters: 0,
      durationSeconds: 0,
      legs: [],
      cacheHit: false,
      fallbackUsed: true,
      fallbackReason: 'api_error',
      warnings: [`Estimated visual route — road path unavailable (${err.message}).`],
    };
  }
}
