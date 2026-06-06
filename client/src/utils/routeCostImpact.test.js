import { describe, it, expect } from 'vitest';
import { computeRouteCostImpact } from './routeCostImpact.js';
import { getCostEfficiencyLabel } from '../pages/CRMPreview/components/RouteFinder/routeEconomics.js';

describe('routeCostImpact', () => {
  it('calculates fuel and labor from added miles and minutes', () => {
    const impact = computeRouteCostImpact({ addedMiles: 3.1, addedDriveMinutes: 6 });
    expect(impact.addedFuelCost).toBeGreaterThan(0);
    expect(impact.addedLaborCost).toBeGreaterThan(0);
    expect(impact.estimatedAddedCost).toBeCloseTo(
      impact.addedFuelCost + impact.addedLaborCost,
      2,
    );
    expect(impact.isEstimated).toBe(true);
  });

  it('assigns efficiency labels by total cost', () => {
    expect(getCostEfficiencyLabel(3).key).toBe('excellent');
    expect(getCostEfficiencyLabel(8).key).toBe('good');
    expect(getCostEfficiencyLabel(15).key).toBe('fair');
    expect(getCostEfficiencyLabel(30).key).toBe('poor');
  });
});
