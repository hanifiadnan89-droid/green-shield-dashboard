import { describe, it, expect } from 'vitest';
import {
  hasCorridorOwnerNotScheduledComparisonDiagnostics,
  isTerritoryDiagnosticNotScheduled,
  reclassifyRealRouteResultAsCorridorOwnerNotScheduled,
  shouldReclassifyFailureFromComparisonDiagnostics,
} from '../validationCalibrationSummarySafety.js';
import { getValidationExampleById } from '../validationExamples.js';

describe('validationCalibrationSummarySafety', () => {
  it('detects corridor-owner-not-scheduled comparison diagnostics', () => {
    const expectedTerritory = {
      scheduled: false,
      unavailabilityReasons: ['not_scheduled'],
    };
    const winnerTerritory = {
      scheduled: false,
      unavailabilityReasons: ['not_scheduled'],
    };

    expect(isTerritoryDiagnosticNotScheduled(expectedTerritory)).toBe(true);
    expect(hasCorridorOwnerNotScheduledComparisonDiagnostics(
      expectedTerritory,
      winnerTerritory,
    )).toBe(true);
  });

  it('does not reclassify when either technician is scheduled on the route cache', () => {
    expect(hasCorridorOwnerNotScheduledComparisonDiagnostics(
      { scheduled: false, unavailabilityReasons: ['not_scheduled'] },
      { scheduled: true, unavailabilityReasons: [] },
    )).toBe(false);
  });

  it('reclassifies applicable failures when comparison diagnostics match', () => {
    const windhamExample = getValidationExampleById('windham-general-example-024');
    const technicians = [
      {
        techName: 'Paige Bullock',
        routeId: 'R-2026-06-04-PB',
        stops: [{ address: '100 Main St, Westbrook, ME' }],
      },
      {
        techName: 'Ian Pratt',
        routeId: 'R-2026-06-04-IP',
        stops: [{ address: '220 US Route 1, Scarborough, ME' }],
      },
    ];
    const result = {
      id: windhamExample.id,
      passed: false,
      applicable: true,
      expectedTechName: 'Chris McGary',
      actualTopTechName: 'Skyler Ruest',
      expectedRank: null,
      acceptedRankMax: 2,
      topMatches: [],
      failureReason: 'Expected technician not found in top 3: Chris McGary, Paige Bullock',
      dispatcherReason: windhamExample.dispatcherReason,
      notes: '',
      technicianCount: 2,
      routeDate: '2026-06-04',
      routeTechnicianCount: 2,
      topTechStopCount: 0,
      topTechOverPreferredMax: false,
      topTechOverHardMax: false,
      dayMismatchWarnings: [],
      topCandidates: [],
      skipReason: null,
      skipLabel: null,
      calibrationOutcome: 'true_scoring_failure',
      countedInRealRoutePassRate: true,
      territoryRepresented: true,
      acceptableTechScheduled: true,
    };
    const scoringResult = {
      topMatches: [
        {
          techName: 'Skyler Ruest',
          routeId: 'R-2026-06-04-SR',
          scores: { total: 92 },
          v2Score: { adjustedTotal: 92, baseTotal: 92, penalties: [], bonuses: [] },
          v2Profile: { eligibilityStatus: 'eligible' },
        },
      ],
    };

    expect(shouldReclassifyFailureFromComparisonDiagnostics(
      result,
      windhamExample,
      technicians,
      scoringResult,
    )).toBe(true);

    const reclassified = reclassifyRealRouteResultAsCorridorOwnerNotScheduled(result);
    expect(reclassified.applicable).toBe(false);
    expect(reclassified.skipReason).toBe('expected_corridor_owner_not_scheduled');
    expect(reclassified.calibrationOutcome).toBe('skipped');
    expect(reclassified.countedInRealRoutePassRate).toBe(false);
  });
});
