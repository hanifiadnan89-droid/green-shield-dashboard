import { describe, expect, it } from 'vitest';
import { isCompactPolygon, isNearFirstVertex, rectangleToPolygon } from '../propertyMapDrawing.js';

describe('propertyMapDrawing', () => {
  it('builds a rectangle polygon from two corners', () => {
    const path = rectangleToPolygon(
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5002, lng: -70.3998 },
    );
    expect(path).toHaveLength(4);
    expect(path[0]).toEqual({ lat: 43.5002, lng: -70.4 });
  });

  it('detects compact polygons', () => {
    const compact = rectangleToPolygon(
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5005, lng: -70.3995 },
    );
    expect(isCompactPolygon(compact)).toBe(true);
  });

  it('rejects neighborhood-sized polygons', () => {
    const large = [
      { lat: 43.5, lng: -70.4 },
      { lat: 43.52, lng: -70.4 },
      { lat: 43.52, lng: -70.38 },
      { lat: 43.5, lng: -70.38 },
    ];
    expect(isCompactPolygon(large)).toBe(false);
  });

  it('detects clicks near the first vertex', () => {
    const first = { lat: 43.5, lng: -70.4 };
    const nearby = { lat: 43.50008, lng: -70.39995 };
    const far = { lat: 43.502, lng: -70.4 };
    expect(isNearFirstVertex(nearby, first, null, 20)).toBe(true);
    expect(isNearFirstVertex(far, first, null, 20)).toBe(false);
  });
});
