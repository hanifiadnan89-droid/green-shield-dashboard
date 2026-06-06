import { describe, it, expect } from 'vitest';
import {
  HaversineTravelTimeProvider,
  haversineMiles,
  travelMinutesFromMiles,
} from './routeTravelTimeProvider.js';

describe('routeTravelTimeProvider', () => {
  it('returns haversine distance between two points', () => {
    const miles = haversineMiles(43.322, -70.584, 43.340, -70.555);
    expect(miles).toBeGreaterThan(0);
    expect(miles).toBeLessThan(5);
  });

  it('HaversineTravelTimeProvider returns estimated warnings', () => {
    const result = HaversineTravelTimeProvider.getDistanceMiles(
      { lat: 43.322, lng: -70.584 },
      { lat: 43.340, lng: -70.555 },
    );
    expect(result.provider).toBe('haversine');
    expect(result.accuracy).toBe('estimated');
    expect(result.distanceMiles).toBeGreaterThan(0);
    expect(result.travelMinutes).toBeGreaterThan(0);
    expect(result.warnings.some(w => /estimated/i.test(w))).toBe(true);
  });

  it('getRouteMatrix returns legs between stops', () => {
    const matrix = HaversineTravelTimeProvider.getRouteMatrix([
      { lat: 43.322, lng: -70.584 },
      { lat: 43.340, lng: -70.555 },
      { lat: 43.360, lng: -70.530 },
    ]);
    expect(matrix.legs).toHaveLength(2);
    expect(matrix.accuracy).toBe('estimated');
  });

  it('travelMinutesFromMiles uses speed heuristic', () => {
    expect(travelMinutesFromMiles(1)).toBeGreaterThan(0);
    expect(travelMinutesFromMiles(10)).toBeGreaterThan(travelMinutesFromMiles(1));
  });
});
