import { describe, it, expect } from 'vitest';
import {
  buildTrustWarnings,
  computeConfidenceLabel,
  enrichMatchWithTrustAndCost,
} from './routeTrustWarnings.js';
import { generalHappyPath } from './__tests__/fieldRoutesScorer.fixtures.js';
import { scoreRoutes } from './fieldRoutesScorer.js';
import { HaversineTravelTimeProvider } from './routeTravelTimeProvider.js';

describe('routeTrustWarnings', () => {
  it('warns when drive time is estimated', () => {
    const result = scoreRoutes(generalHappyPath.technicians, generalHappyPath.lead, 1);
    const match = result.topMatches[0];
    const warnings = buildTrustWarnings(match, generalHappyPath.lead, {
      tech: generalHappyPath.technicians[0],
      travelProvider: HaversineTravelTimeProvider,
    });
    expect(warnings.some(w => w.code === 'estimated_drive_time')).toBe(true);
  });

  it('warns on estimated service duration', () => {
    const lead = { ...generalHappyPath.lead, durationConfidence: 'estimated', durationMinutes: 75 };
    const warnings = buildTrustWarnings({ bestInsertion: {}, capacity: { maxHours: 10, remainingHours: 5 } }, lead, {});
    expect(warnings.some(w => w.code === 'estimated_duration')).toBe(true);
  });

  it('enriches match with confidence and cost impact', () => {
    const result = scoreRoutes(generalHappyPath.technicians, generalHappyPath.lead, 1);
    const match = result.topMatches[0];
    const enriched = enrichMatchWithTrustAndCost(match, generalHappyPath.lead, {
      tech: generalHappyPath.technicians[0],
      travelProvider: HaversineTravelTimeProvider,
    });
    expect(['High', 'Medium', 'Low']).toContain(enriched.confidenceLabel);
    expect(enriched.costImpact.estimatedAddedCost).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(enriched.trustBadges)).toBe(true);
  });

  it('lowers confidence when risks present', () => {
    const label = computeConfidenceLabel(
      { clusterDensity: 0, bestInsertion: { detourMiles: 12, timedRisk: 'high' }, capacity: { remainingHours: 0.1 } },
      { durationConfidence: 'custom' },
      [{ severity: 'risk', code: 'x' }],
    );
    expect(label).toBe('Low');
  });
});
