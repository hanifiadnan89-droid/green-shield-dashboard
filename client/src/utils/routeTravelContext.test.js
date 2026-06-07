import { describe, it, expect } from 'vitest';
import { collectTargetedTravelLegs } from './routeTravelContext.js';
import { estimateBilledElements, estimateMatrixElements } from './routeTravelBudget.js';

function makeTech(routeId, stopCount, latOffset = 0) {
  const stops = Array.from({ length: stopCount }, (_, i) => ({
    lat: 43 + latOffset + i * 0.02,
    lng: -70 - latOffset - i * 0.01,
    customerName: `${routeId} Stop ${i + 1}`,
  }));
  return {
    routeId,
    startLocation: { lat: 43 + latOffset, lng: -70 - latOffset },
    endLocation: { lat: 43.5 + latOffset, lng: -70.5 - latOffset },
    stops,
  };
}

describe('collectTargetedTravelLegs', () => {
  it('collects fewer billed elements than a full stop matrix for one route', () => {
    const tech = makeTech('r1', 12);
    const lead = { lat: 43.25, lng: -70.25 };
    const legs = collectTargetedTravelLegs([tech], lead);
    const fullMatrix = tech.stops.flatMap(a => tech.stops.map(b => ({ origin: a, destination: b })));

    expect(legs.length).toBeGreaterThan(0);
    expect(legs.length).toBeLessThan(fullMatrix.length);
    expect(estimateBilledElements(legs)).toBeLessThan(estimateBilledElements(fullMatrix));
    expect(estimateMatrixElements(fullMatrix)).toBe(144);
  });

  it('scales linearly with technician count for targeted mode', () => {
    const lead = { lat: 43.25, lng: -70.25 };
    const one = collectTargetedTravelLegs([makeTech('a', 8, 0)], lead);
    const two = collectTargetedTravelLegs([makeTech('a', 8, 0), makeTech('b', 8, 1.5)], lead);
    expect(two.length).toBeGreaterThan(one.length);
    expect(two.length).toBeLessThan(one.length * 2.5);
  });
});
