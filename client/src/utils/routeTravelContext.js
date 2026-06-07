import {
  haversineMiles,
  travelMinutesFromMiles,
  HaversineTravelTimeProvider,
} from './routeTravelTimeProvider.js';
import { api } from '../api/client.js';

function pointKey(point) {
  if (!point?.lat || !point?.lng) return null;
  return `${Math.round(point.lat * 10000)}:${Math.round(point.lng * 10000)}`;
}

function legKey(origin, destination) {
  const a = pointKey(origin);
  const b = pointKey(destination);
  if (!a || !b) return null;
  return `${a}->${b}`;
}

/**
 * @param {Array<{ origin: object, destination: object, result: object }>} legEntries
 */
export function buildTravelContextFromLegs(legEntries = [], diagnostics = {}) {
  const map = new Map();
  for (const entry of legEntries) {
    const key = legKey(entry.origin, entry.destination);
    if (key) map.set(key, entry.result);
  }

  const provider = diagnostics.matrixProvider || 'haversine';

  const getSegment = (origin, destination) => {
    const key = legKey(origin, destination);
    if (key && map.has(key)) return map.get(key);
    const distanceMiles = haversineMiles(origin.lat, origin.lng, destination.lat, destination.lng);
    return {
      distanceMiles,
      travelMinutes: travelMinutesFromMiles(distanceMiles),
      provider: 'haversine',
      accuracy: 'estimated',
      trafficAware: false,
      warnings: ['Road-based drive time unavailable; using estimated straight-line distance.'],
    };
  };

  const travelDiagnostics = {
    travelProvider: provider,
    travelAccuracy: provider === 'google-routes' ? 'road-based' : 'estimated',
    fallbackUsed: Boolean(diagnostics.fallbackUsed),
    fallbackReason: diagnostics.fallbackReason || (diagnostics.fallbackUsed ? 'haversine_fallback' : null),
    matrixElementsRequested: diagnostics.matrixElementsRequested ?? diagnostics.elementsRequested ?? 0,
    cacheHit: Boolean(diagnostics.cacheHit),
  };

  return {
    provider,
    diagnostics,
    travelDiagnostics,
    getSegment,
    getTravelMinutes(origin, destination) {
      return getSegment(origin, destination).travelMinutes;
    },
    getDistanceMiles(origin, destination) {
      return getSegment(origin, destination).distanceMiles;
    },
    getProviderName() {
      return provider;
    },
    getProviderAccuracy() {
      return provider === 'google-routes' ? 'road-based' : 'estimated';
    },
  };
}

/**
 * Collect leg pairs needed for route scoring (consecutive + each stop to lead).
 */
export function collectRouteTravelLegs(technicians = [], lead = {}) {
  const legs = [];
  const seen = new Set();
  const leadPoint = lead.lat != null && lead.lng != null ? { lat: lead.lat, lng: lead.lng } : null;

  const pushLeg = (origin, destination) => {
    if (!origin?.lat || !destination?.lat) return;
    const key = legKey(origin, destination);
    if (!key || seen.has(key)) return;
    seen.add(key);
    legs.push({ origin, destination });
  };

  for (const tech of technicians) {
    const stops = (tech.stops || []).filter(s => s.lat && s.lng);
    const start = tech.startLocation?.lat != null ? tech.startLocation : null;
    const end = tech.endLocation?.lat != null ? tech.endLocation : null;

    if (start && stops[0]) pushLeg(start, stops[0]);
    for (let i = 0; i < stops.length - 1; i++) {
      pushLeg(stops[i], stops[i + 1]);
    }
    if (end && stops.length) pushLeg(stops[stops.length - 1], end);

    if (leadPoint) {
      if (start) pushLeg(start, leadPoint);
      for (const stop of stops) pushLeg(stop, leadPoint);
      pushLeg(leadPoint, stops[0]);
      for (let i = 0; i < stops.length - 1; i++) {
        pushLeg(leadPoint, stops[i]);
        pushLeg(stops[i], leadPoint);
        pushLeg(leadPoint, stops[i + 1]);
      }
      if (stops.length) {
        pushLeg(leadPoint, stops[stops.length - 1]);
        pushLeg(stops[stops.length - 1], leadPoint);
      }
      if (end) pushLeg(leadPoint, end);
    }
  }

  return legs;
}

/**
 * Prefetch road-based legs from the server (falls back server-side to haversine).
 */
export async function prefetchTravelContext(technicians, lead, { trafficAware = false } = {}) {
  const legs = collectRouteTravelLegs(technicians, lead);
  if (!legs.length) {
    return buildTravelContextFromLegs([], {
      matrixProvider: HaversineTravelTimeProvider.getProviderName(),
      cacheHit: false,
      elementsRequested: 0,
      fallbackUsed: true,
    });
  }

  try {
    const response = await api.routes.travelLegs({
      legs,
      context: { date: lead?.date || null },
      trafficAware,
    });

    const entries = legs.map((leg, index) => ({
      origin: leg.origin,
      destination: leg.destination,
      result: response.legs?.[index] || HaversineTravelTimeProvider.getDistanceMiles(leg.origin, leg.destination),
    }));

    const ctx = buildTravelContextFromLegs(entries, response.diagnostics || {});
    if (response.diagnostics?.fallbackUsed) {
      console.info('[route-finder] travel matrix fallback', response.diagnostics);
    } else if (response.diagnostics?.matrixProvider === 'google-routes') {
      console.info('[route-finder] travel matrix google-routes', {
        elements: response.diagnostics.matrixElementsRequested,
        cacheHit: response.diagnostics.cacheHit,
      });
    }
    return ctx;
  } catch (err) {
    const entries = legs.map(leg => ({
      origin: leg.origin,
      destination: leg.destination,
      result: HaversineTravelTimeProvider.getDistanceMiles(leg.origin, leg.destination),
    }));
    console.warn('[route-finder] travel legs fetch failed', err?.message);
    return buildTravelContextFromLegs(entries, {
      matrixProvider: 'haversine',
      travelProvider: 'haversine',
      travelAccuracy: 'estimated',
      cacheHit: false,
      elementsRequested: legs.length,
      matrixElementsRequested: legs.length,
      fallbackUsed: true,
      fallbackReason: 'client_fetch_failed',
    });
  }
}
