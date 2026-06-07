import { describe, it, expect } from 'vitest';
import { scoreRoutes } from './fieldRoutesScorer.js';

const PORTLAND_LEAD = {
  lat: 43.6591,
  lng: -70.2568,
  serviceType: 'Regular Service',
  durationMinutes: 30,
  timeWindowPreference: 'AT',
  routeArea: 'maine',
  date: '2026-06-09',
  customerName: 'Portland Customer',
  address: 'Portland, ME',
};

const portlandStops = [
  { lat: 43.652, lng: -70.262, customerName: 'P1', address: 'P1', spotStartMinutes: 540, durationMinutes: 30, routeOrder: 1 },
  { lat: 43.661, lng: -70.251, customerName: 'P2', address: 'P2', spotStartMinutes: 600, durationMinutes: 30, routeOrder: 2 },
  { lat: 43.668, lng: -70.245, customerName: 'P3', address: 'P3', spotStartMinutes: 660, durationMinutes: 30, routeOrder: 3 },
];

const damariscottaStops = [
  { lat: 44.032, lng: -69.525, customerName: 'D1', address: 'D1', spotStartMinutes: 540, durationMinutes: 30, routeOrder: 1 },
  { lat: 44.038, lng: -69.518, customerName: 'D2', address: 'D2', spotStartMinutes: 600, durationMinutes: 30, routeOrder: 2 },
  { lat: 44.045, lng: -69.510, customerName: 'D3', address: 'D3', spotStartMinutes: 660, durationMinutes: 30, routeOrder: 3 },
];

const deceptiveStops = [
  { lat: 43.660, lng: -70.258, customerName: 'Near Portland', address: 'Near', spotStartMinutes: 540, durationMinutes: 30, routeOrder: 1 },
  ...damariscottaStops.slice(1),
];

describe('fieldRoutesScorer area viability integration', () => {
  it('prefers Portland-area technician over Damariscotta technician for Portland job', () => {
    const technicians = [
      {
        techId: '1',
        techName: 'Far Tech',
        routeId: 'FAR-01',
        startLocation: { lat: 44.032, lng: -69.525 },
        endLocation: { lat: 44.032, lng: -69.525 },
        routeDurationCapacityRaw: '3 / 10.5',
        stops: damariscottaStops,
      },
      {
        techId: '2',
        techName: 'Local Tech',
        routeId: 'LOC-01',
        startLocation: { lat: 43.64, lng: -70.27 },
        endLocation: { lat: 43.64, lng: -70.27 },
        routeDurationCapacityRaw: '3 / 10.5',
        stops: portlandStops,
      },
    ];

    const result = scoreRoutes(technicians, PORTLAND_LEAD, 3, { prefetchTravel: false });
    expect(result.topMatches[0].routeId).toBe('LOC-01');
    expect(result.topMatches[0].areaViability.areaViability).not.toBe('out_of_area');
    const farMatch = result.topMatches.find(m => m.routeId === 'FAR-01');
    expect(farMatch).toBeUndefined();
  });

  it('does not rank deceptive far route above local route', () => {
    const technicians = [
      {
        techId: '1',
        techName: 'Deceptive Tech',
        routeId: 'DEC-01',
        startLocation: { lat: 44.032, lng: -69.525 },
        endLocation: { lat: 44.032, lng: -69.525 },
        routeDurationCapacityRaw: '3 / 10.5',
        stops: deceptiveStops,
      },
      {
        techId: '2',
        techName: 'Local Tech',
        routeId: 'LOC-01',
        startLocation: { lat: 43.64, lng: -70.27 },
        endLocation: { lat: 43.64, lng: -70.27 },
        routeDurationCapacityRaw: '3 / 10.5',
        stops: portlandStops,
      },
    ];

    const result = scoreRoutes(technicians, PORTLAND_LEAD, 3, { prefetchTravel: false });
    expect(result.topMatches[0].routeId).toBe('LOC-01');
  });

  it('includes technician home start and end in routeStops when available', () => {
    const technicians = [{
      techId: '2',
      techName: 'Local Tech',
      routeId: 'LOC-01',
      startLocation: { lat: 43.64, lng: -70.27 },
      endLocation: { lat: 43.64, lng: -70.27 },
      routeDurationCapacityRaw: '3 / 10.5',
      stops: portlandStops,
    }];

    const result = scoreRoutes(technicians, PORTLAND_LEAD, 1, { prefetchTravel: false });
    const stops = result.topMatches[0].routeStops;
    expect(stops[0].isHomeStart).toBe(true);
    expect(stops[stops.length - 1].isHomeEnd).toBe(true);
    expect(stops.some(s => s.isNew)).toBe(true);
  });

  it('handles missing start/end without crashing', () => {
    const technicians = [{
      techId: '3',
      techName: 'No Home Tech',
      routeId: 'NH-01',
      startLocation: null,
      endLocation: null,
      routeDurationCapacityRaw: '3 / 10.5',
      stops: portlandStops,
    }];

    const result = scoreRoutes(technicians, PORTLAND_LEAD, 1, { prefetchTravel: false });
    expect(result.topMatches.length).toBe(1);
    expect(result.topMatches[0].routeStops.every(s => !s.isHomeStart)).toBe(true);
  });

  it('allows out-of-area route only as fallback when no local options exist', () => {
    const technicians = [{
      techId: '1',
      techName: 'Far Only',
      routeId: 'FAR-ONLY',
      startLocation: { lat: 44.032, lng: -69.525 },
      endLocation: { lat: 44.032, lng: -69.525 },
      routeDurationCapacityRaw: '3 / 10.5',
      stops: damariscottaStops,
    }];

    const result = scoreRoutes(technicians, PORTLAND_LEAD, 1, { prefetchTravel: false });
    expect(result.topMatches[0].routeId).toBe('FAR-ONLY');
    expect(result.topMatches[0].areaFallbackOnly).toBe(true);
  });

  it('populates full-day timing fields when home locations exist', () => {
    const technicians = [{
      techId: '2',
      techName: 'Local Tech',
      routeId: 'LOC-01',
      startLocation: { lat: 43.64, lng: -70.27 },
      endLocation: { lat: 43.64, lng: -70.27 },
      routeDurationCapacityRaw: '3 / 10.5',
      stops: portlandStops,
    }];

    const result = scoreRoutes(technicians, PORTLAND_LEAD, 1, { prefetchTravel: false });
    const feasibility = result.topMatches[0].routeFeasibility;
    expect(feasibility.homeToFirstStopDriveMinutes).toBeGreaterThanOrEqual(0);
    expect(feasibility.projectedFullDayMinutes).toBeGreaterThan(0);
  });
});
