import { describe, it, expect } from 'vitest';
import { getMapCoordinateStatus, getMapStops } from './routeMapStops.js';
import { describeMapLoadError, classifyMapsError } from './mapLoadErrors.js';

describe('getMapCoordinateStatus', () => {
  it('reports no_coordinates when stops lack lat/lng', () => {
    const status = getMapCoordinateStatus([
      { lat: null, lng: null },
      { lat: undefined, lng: 1 },
    ]);
    expect(status.ok).toBe(false);
    expect(status.code).toBe('no_coordinates');
  });

  it('accepts stops with finite coordinates', () => {
    const status = getMapCoordinateStatus([
      { lat: 43.2, lng: -70.3 },
      { lat: '43.3', lng: '-70.4' },
    ]);
    expect(status.ok).toBe(true);
    expect(getMapStops).toBeDefined();
    expect(getMapStops([
      { lat: 43.2, lng: -70.3 },
      { lat: '43.3', lng: '-70.4' },
    ])).toHaveLength(2);
  });

  it('allows partial coordinates and still renders valid stops', () => {
    const stops = [
      { lat: 43.2, lng: -70.3, customerName: 'A' },
      { lat: null, lng: null, customerName: 'B' },
      { lat: 43.25, lng: -70.35, customerName: 'C', isNew: true },
    ];
    const status = getMapCoordinateStatus(stops);
    expect(status.ok).toBe(true);
    expect(status.code).toBe('partial_coordinates');
    expect(status.withCoords).toBe(2);
  });
});

describe('mapLoadErrors', () => {
  it('classifies referer errors', () => {
    expect(classifyMapsError('RefererNotAllowedMapError')).toBe('referer_denied');
  });

  it('describes no_coordinates for UI', () => {
    const { title } = describeMapLoadError('no_coordinates');
    expect(title).toMatch(/Map unavailable/i);
    expect(title).toMatch(/missing coordinates/i);
  });
});
