import {
  haversineMiles,
  travelMinutesFromMiles,
  HaversineTravelTimeProvider,
} from './routeTravelTimeProvider.js';
import { api } from '../api/client.js';
import { getRoutesApiConfig, createSearchElementBudget } from './routesApiConfig.js';
import { estimateBilledElements } from './routeTravelBudget.js';

function pointKey(point) {
  if (!point?.lat || !point?.lng) return null;
  return `${Math.round(point.lat * 100000)}:${Math.round(point.lng * 100000)}`;
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

  const provider = diagnostics.matrixProvider || diagnostics.travelProvider || 'haversine';

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
    roadTimingUsed: Boolean(diagnostics.roadTimingUsed ?? provider === 'google-routes'),
    fallbackUsed: Boolean(diagnostics.fallbackUsed),
    fallbackReason: diagnostics.fallbackReason || (diagnostics.fallbackUsed ? 'haversine_fallback' : null),
    matrixElementsRequested: diagnostics.matrixElementsRequested ?? diagnostics.elementsRequested ?? 0,
    elementsRequested: diagnostics.elementsRequested ?? 0,
    elementsFromCache: diagnostics.elementsFromCache ?? 0,
    elementsBudgetRemaining: diagnostics.elementsBudgetRemaining ?? null,
    routesRoadScored: diagnostics.routesRoadScored ?? 0,
    routesEstimatedOnly: diagnostics.routesEstimatedOnly ?? 0,
    cacheHit: Boolean(diagnostics.cacheHit),
    targetedMode: Boolean(diagnostics.targetedMode),
    pairwiseMode: Boolean(diagnostics.pairwiseMode),
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

function pushLeg(legs, seen, origin, destination) {
  if (!origin?.lat || !destination?.lat) return;
  const key = legKey(origin, destination);
  if (!key || seen.has(key)) return;
  seen.add(key);
  legs.push({
    origin:      { lat: origin.lat,      lng: origin.lng },
    destination: { lat: destination.lat, lng: destination.lng },
  });
}

/**
 * Targeted legs for one technician: route timeline + insertion probe edges only.
 */
export function collectTargetedTravelLegs(technicians = [], lead = {}) {
  const legs = [];
  const seen = new Set();
  const leadPoint = lead.lat != null && lead.lng != null ? { lat: lead.lat, lng: lead.lng } : null;

  for (const tech of technicians) {
    const stops = (tech.stops || []).filter(s => s.lat && s.lng);
    const start = tech.startLocation?.lat != null ? tech.startLocation : null;
    const end = tech.endLocation?.lat != null ? tech.endLocation : null;

    if (start && stops[0]) pushLeg(legs, seen, start, stops[0]);
    for (let i = 0; i < stops.length - 1; i++) {
      pushLeg(legs, seen, stops[i], stops[i + 1]);
    }
    if (end && stops.length) pushLeg(legs, seen, stops[stops.length - 1], end);

    if (!leadPoint) continue;

    for (let insertIdx = -1; insertIdx < stops.length; insertIdx++) {
      const afterStop = insertIdx >= 0 ? stops[insertIdx] : null;
      const beforeStop = insertIdx + 1 < stops.length ? stops[insertIdx + 1] : null;

      const prevPt = afterStop
        ?? (start?.lat != null ? start : (stops[0] ?? null));
      const nextPt = beforeStop
        ?? (end?.lat != null ? end : (stops[stops.length - 1] ?? null));

      if (prevPt?.lat) pushLeg(legs, seen, prevPt, leadPoint);
      if (nextPt?.lat) pushLeg(legs, seen, leadPoint, nextPt);
    }
  }

  return legs;
}

/**
 * Legacy broad leg collection (all probe pairs). Prefer collectTargetedTravelLegs.
 */
export function collectRouteTravelLegs(technicians = [], lead = {}) {
  return collectTargetedTravelLegs(technicians, lead);
}

/**
 * Prefetch road-based legs from the server (falls back server-side to haversine).
 */
export async function prefetchTravelContext(technicians, lead, options = {}) {
  const config = getRoutesApiConfig();
  const budget = options.budget || createSearchElementBudget(config);
  const targetedMode = options.targetedOnly !== false;

  const legs = targetedMode
    ? collectTargetedTravelLegs(technicians, lead)
    : collectTargetedTravelLegs(technicians, lead);

  if (!legs.length) {
    return buildTravelContextFromLegs([], {
      matrixProvider: HaversineTravelTimeProvider.getProviderName(),
      cacheHit: false,
      elementsRequested: 0,
      fallbackUsed: true,
      routesEstimatedOnly: technicians.length,
    });
  }

  if (!config.enableRoadTiming || options.prefetchTravel === false) {
    const entries = legs.map(leg => ({
      origin: leg.origin,
      destination: leg.destination,
      result: HaversineTravelTimeProvider.getDistanceMiles(leg.origin, leg.destination),
    }));
    return buildTravelContextFromLegs(entries, {
      matrixProvider: 'haversine',
      fallbackUsed: true,
      fallbackReason: 'road_timing_disabled',
      elementsRequested: 0,
      routesEstimatedOnly: technicians.length,
    });
  }

  const estimatedElements = estimateBilledElements(legs, {
    maxElementsPerRoute: budget.maxElementsPerRoute,
  });
  if (import.meta.env.DEV) {
    console.debug('[route-finder] travel prefetch', {
      techs: technicians.length,
      legs: legs.length,
      estimatedBilledElements: estimatedElements,
      budgetRemaining: budget.remainingSearchElements,
      targetedMode,
    });
  }

  try {
    const response = await api.routes.travelLegs({
      legs,
      context: {
        date: lead?.date || null,
        routeId: technicians.length === 1 ? technicians[0]?.routeId : null,
        targetedMode,
        budget,
      },
      trafficAware: options.trafficAware ?? false,
    });

    if (response.budget) {
      budget.remainingSearchElements = response.budget.elementsBudgetRemaining ?? budget.remainingSearchElements;
      budget.elementsRequested += response.budget.elementsRequested ?? 0;
      budget.elementsFromCache += response.budget.elementsFromCache ?? 0;
    }

    const entries = legs.map((leg, index) => ({
      origin: leg.origin,
      destination: leg.destination,
      result: response.legs?.[index] || HaversineTravelTimeProvider.getDistanceMiles(leg.origin, leg.destination),
    }));

    const diagnostics = {
      ...(response.diagnostics || {}),
      targetedMode,
      routesRoadScored: technicians.length,
    };

    const ctx = buildTravelContextFromLegs(entries, diagnostics);
    if (import.meta.env.DEV) {
      if (response.diagnostics?.fallbackUsed) {
        console.info('[route-finder] travel matrix fallback', response.diagnostics);
      } else if (response.diagnostics?.matrixProvider === 'google-routes') {
        console.info('[route-finder] travel matrix google-routes', {
          elements: response.diagnostics.matrixElementsRequested,
          cacheHit: response.diagnostics.cacheHit,
          budgetRemaining: response.diagnostics.elementsBudgetRemaining,
        });
      }
    }
    return ctx;
  } catch (err) {
    const is413 = err?.status === 413 || err?.httpStatus === 413 || err?.message?.includes('413');
    const entries = legs.map(leg => ({
      origin: leg.origin,
      destination: leg.destination,
      result: HaversineTravelTimeProvider.getDistanceMiles(leg.origin, leg.destination),
    }));
    if (is413) {
      console.warn('[route-finder] travel legs payload too large (413) — falling back to haversine');
    } else {
      console.warn('[route-finder] travel legs fetch failed', err?.message);
    }
    return buildTravelContextFromLegs(entries, {
      matrixProvider: 'haversine',
      travelProvider: 'haversine',
      travelAccuracy: 'estimated',
      cacheHit: false,
      elementsRequested: 0,
      fallbackUsed: true,
      fallbackReason: is413 ? 'payload_too_large' : 'client_fetch_failed',
      routesEstimatedOnly: technicians.length,
    });
  }
}
