import { describe, it, expect } from 'vitest';
import {
  computePolygonAreaAcres,
  computePolygonAreaSqFt,
  formatAcreage,
} from '../polygonArea.js';

describe('polygonArea', () => {
  it('computes area for a small square near equator', () => {
    const path = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0.001, lng: 0.001 },
      { lat: 0.001, lng: 0 },
    ];
    const sqFt = computePolygonAreaSqFt(path);
    const acres = computePolygonAreaAcres(path);
    expect(sqFt).toBeGreaterThan(0);
    expect(acres).toBeGreaterThan(0);
    expect(acres).toBeCloseTo(sqFt / 43560, 6);
  });

  it('returns zero for fewer than three points', () => {
    expect(computePolygonAreaSqFt([{ lat: 0, lng: 0 }])).toBe(0);
    expect(computePolygonAreaAcres([])).toBe(0);
  });

  it('formats acreage with sensible precision', () => {
    expect(formatAcreage(0.5)).toBe('0.500');
    expect(formatAcreage(2.456)).toBe('2.46');
  });
});
