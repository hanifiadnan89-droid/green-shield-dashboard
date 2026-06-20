import { describe, expect, it } from 'vitest';
import { boundsToPolygon, estimateLotBoundary, resolveAutoBoundary } from '../propertyBoundary.js';

describe('propertyBoundary', () => {
  it('converts plain bounds to polygon', () => {
    const polygon = boundsToPolygon({
      north: 41.1,
      south: 41.09,
      east: -73.9,
      west: -73.91,
    });
    expect(polygon).toHaveLength(4);
    expect(polygon[0]).toEqual({ lat: 41.1, lng: -73.91 });
  });

  it('estimates a lot boundary around coordinates', () => {
    const polygon = estimateLotBoundary({
      latitude: 41.0,
      longitude: -73.0,
      propertyUseEstimate: 'Residential',
    });
    expect(polygon).toHaveLength(4);
  });

  it('prefers viewport over estimate', () => {
    const result = resolveAutoBoundary({
      viewport: { north: 41.1, south: 41.09, east: -73.9, west: -73.91 },
      latitude: 41.0,
      longitude: -73.0,
    });
    expect(result?.method).toBe('viewport');
    expect(result?.polygon).toHaveLength(4);
  });
});
