import { describe, expect, it } from 'vitest';
import {
  isCompactPolygon,
  isNearFirstVertex,
  rectangleToPolygon,
  shouldClosePolygonOnClick,
} from '../propertyMapDrawing.js';

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

  it('does not close before three vertices exist', () => {
    const verts = [
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5001, lng: -70.4 },
    ];
    const click = { lat: 43.5, lng: -70.4 };
    expect(shouldClosePolygonOnClick(click, verts, null, null)).toBe(false);
  });

  it('does not close when click is far from first vertex on fallback distance', () => {
    const verts = [
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5002, lng: -70.4 },
      { lat: 43.5002, lng: -70.3998 },
      { lat: 43.5, lng: -70.3998 },
    ];
    const farClick = { lat: 43.50015, lng: -70.3999 };
    expect(shouldClosePolygonOnClick(farClick, verts, null, null)).toBe(false);
  });

  it('closes on fallback distance only when click is near the first vertex', () => {
    const first = { lat: 43.5, lng: -70.4 };
    const verts = [
      first,
      { lat: 43.5002, lng: -70.4 },
      { lat: 43.5002, lng: -70.3998 },
    ];
    const nearClick = { lat: 43.50002, lng: -70.39998 };
    expect(shouldClosePolygonOnClick(nearClick, verts, null, null)).toBe(true);
    expect(isNearFirstVertex(nearClick, first, null, 4)).toBe(true);
  });
});
