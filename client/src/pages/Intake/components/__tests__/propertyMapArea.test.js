import { describe, it, expect } from 'vitest';
import { computeAreaMetrics } from '../propertyMapArea.js';

describe('propertyMapArea', () => {
  it('computes acreage from a simple square path', () => {
    const path = [
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5001, lng: -70.4 },
      { lat: 43.5001, lng: -70.3999 },
      { lat: 43.5, lng: -70.3999 },
    ];
    const result = computeAreaMetrics(path);
    expect(result.acres).toBeGreaterThan(0);
    expect(result.sqFt).toBeGreaterThan(0);
  });
});
