import { describe, it, expect } from 'vitest';
import {
  assessAreaViability,
  computeCorridorDistanceMiles,
  classifyCorridorFit,
  selectTopMatchesByAreaViability,
  markAreaFallback,
} from './routeAreaViability.js';
import { ROUTE_AREA_VIABILITY_DEFAULTS } from './routeAreaViabilityConfig.js';

const PORTLAND = { lat: 43.6591, lng: -70.2568 };
const DAMARISCOTTA = { lat: 44.0326, lng: -69.5248 };

function makeTech({ routeId, stops, start, end }) {
  return {
    routeId,
    techName: routeId,
    startLocation: start,
    endLocation: end,
    stops,
    routeDurationCapacityRaw: '2 / 10.5',
  };
}

function makeStop(lat, lng, name, order) {
  return {
    lat,
    lng,
    customerName: name,
    address: name,
    spotStartMinutes: 480 + order * 60,
    durationMinutes: 30,
    routeOrder: order,
  };
}

describe('routeAreaViability', () => {
  it('marks a Damariscotta route out of area for a Portland job', () => {
    const tech = makeTech({
      routeId: 'DM-01',
      start: DAMARISCOTTA,
      end: DAMARISCOTTA,
      stops: [
        makeStop(44.03, -69.52, 'Stop A', 1),
        makeStop(44.04, -69.51, 'Stop B', 2),
        makeStop(44.05, -69.50, 'Stop C', 3),
      ],
    });

    const result = assessAreaViability({
      tech,
      lead: { ...PORTLAND, customerName: 'Portland Lead' },
      stops: tech.stops,
      insertion: { addedDriveMinutes: 20, backtrackingRisk: 'Moderate' },
    });

    expect(result.areaViability).toBe('out_of_area');
    expect(result.shouldSuppressFromTopResults).toBe(true);
    expect(result.routeCentroidMiles).toBeGreaterThan(30);
  });

  it('classifies a nearby Portland route as strong', () => {
    const tech = makeTech({
      routeId: 'PTL-01',
      start: { lat: 43.64, lng: -70.27 },
      end: { lat: 43.64, lng: -70.27 },
      stops: [
        makeStop(43.65, -70.26, 'Stop A', 1),
        makeStop(43.66, -70.25, 'Stop B', 2),
        makeStop(43.67, -70.24, 'Stop C', 3),
      ],
    });

    const result = assessAreaViability({
      tech,
      lead: PORTLAND,
      stops: tech.stops,
      insertion: { addedDriveMinutes: 8, backtrackingRisk: 'None' },
    });

    expect(['strong', 'acceptable']).toContain(result.areaViability);
    expect(result.nearestStopMiles).toBeLessThan(10);
    expect(result.corridorFit).not.toBe('far_off_route');
  });

  it('penalizes a route with one close stop but far centroid', () => {
    const tech = makeTech({
      routeId: 'TRAP-01',
      start: DAMARISCOTTA,
      end: DAMARISCOTTA,
      stops: [
        makeStop(43.66, -70.25, 'Lone Portland Stop', 1),
        makeStop(44.04, -69.51, 'Damariscotta Stop', 2),
        makeStop(44.05, -69.50, 'Damariscotta Stop 2', 3),
      ],
    });

    const result = assessAreaViability({
      tech,
      lead: PORTLAND,
      stops: tech.stops,
      insertion: { addedDriveMinutes: 25, backtrackingRisk: 'High' },
    });

    expect(['weak', 'out_of_area']).toContain(result.areaViability);
    expect(result.nearestStopMiles).toBeLessThan(15);
    expect(result.routeCentroidMiles).toBeGreaterThan(20);
  });

  it('classifies corridor fit thresholds', () => {
    expect(classifyCorridorFit(4)).toBe('on_route');
    expect(classifyCorridorFit(9)).toBe('near_route');
    expect(classifyCorridorFit(15)).toBe('off_route');
    expect(classifyCorridorFit(25)).toBe('far_off_route');
  });

  it('measures corridor distance to route segments', () => {
    const dist = computeCorridorDistanceMiles(43.66, -70.25, [
      { lat: 43.64, lng: -70.27 },
      { lat: 43.68, lng: -70.23 },
    ]);
    expect(dist).toBeLessThan(5);
  });

  it('selectTopMatchesByAreaViability suppresses out-of-area until fallback', () => {
    const local = {
      routeId: 'local',
      scores: { total: 70 },
      areaViability: { areaViability: 'strong', routeCentroidMiles: 5, nearestStopMiles: 4 },
    };
    const far = {
      routeId: 'far',
      scores: { total: 85 },
      areaViability: { areaViability: 'out_of_area', routeCentroidMiles: 40, nearestStopMiles: 38 },
    };

    const top = selectTopMatchesByAreaViability([far, local], 1);
    expect(top[0].routeId).toBe('local');

    const fallbackOnly = selectTopMatchesByAreaViability([far], 1);
    expect(fallbackOnly[0].routeId).toBe('far');
    expect(fallbackOnly[0].areaFallbackOnly).toBe(true);
  });

  it('markAreaFallback adds fallback label', () => {
    const marked = markAreaFallback({ routeId: 'x', reason: 'Good timing.' });
    expect(marked.areaFallbackLabel).toContain('Fallback only');
  });
});
