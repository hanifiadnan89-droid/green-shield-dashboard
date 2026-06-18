import { describe, it, expect } from 'vitest';
import {
  applyCalibrationApplicability,
  evaluateCalibrationApplicability,
  isAcceptableTechScheduled,
  isTechnicianScheduledOnRoute,
  isTerritoryRepresentedInCache,
  profileCoversLeadTown,
  shouldSkipExpectedCorridorOwnerNotScheduled,
  summarizeRealRouteCalibrationResults,
} from '../validationCalibrationApplicability.js';
import { getValidationExamples, getValidationExampleById } from '../validationExamples.js';
import { matchTechnicianProfile } from '../technicianProfiles.js';
import { buildLeadFromValidationExample } from '../validationRunner.js';

describe('validationCalibrationApplicability', () => {
  const kennebunkExample = getValidationExamples()[0];
  const kennebunkLead = buildLeadFromValidationExample(kennebunkExample);
  const josephProfile = matchTechnicianProfile('Joseph Willey');
  const ianProfile = matchTechnicianProfile('Ian Pratt');

  it('treats a two-tech partial route cache as valid territory coverage', () => {
    const technicians = [
      {
        techName: 'Joseph Willey',
        stops: [{ address: '120 Main St, Kennebunk, ME' }],
      },
      {
        techName: 'Ian Pratt',
        stops: [{ address: '100 Congress St, Portland, ME' }],
      },
    ];

    expect(technicians).toHaveLength(2);
    expect(profileCoversLeadTown(josephProfile, kennebunkLead)).toBe(true);
    expect(isTerritoryRepresentedInCache(technicians, kennebunkLead)).toBe(true);
    expect(isAcceptableTechScheduled(technicians, kennebunkExample)).toBe(true);
  });

  it('skips examples outside the cached route territory', () => {
    const sanfordExample = getValidationExamples().find(example => example.id.includes('sanford'));
    expect(sanfordExample).toBeTruthy();

    const technicians = [
      {
        techName: 'Joseph Willey',
        stops: [{ address: '120 Main St, Kennebunk, ME' }],
      },
      {
        techName: 'Ian Pratt',
        stops: [{ address: '100 Congress St, Portland, ME' }],
      },
    ];

    const applicability = evaluateCalibrationApplicability(sanfordExample, {
      technicians,
      selectedRouteDate: '2026-06-06',
    });

    expect(applicability.applicable).toBe(false);
    expect(applicability.skipReason).toBe('expected_territory_not_represented');
  });

  it('skips when territory is represented but expected tech is not scheduled', () => {
    const technicians = [
      {
        techName: 'Ian Pratt',
        stops: [{ address: '120 Main St, Kennebunk, ME' }],
      },
      {
        techName: 'Paige Bullock',
        stops: [{ address: '45 Fletcher St, Kennebunk, ME' }],
      },
    ];

    const applicability = evaluateCalibrationApplicability(kennebunkExample, {
      technicians,
      lead: kennebunkLead,
      selectedRouteDate: '2026-06-06',
    });

    expect(applicability.applicable).toBe(false);
    expect(applicability.skipReason).toBe('expected_tech_not_scheduled');
    expect(applicability.territoryRepresented).toBe(true);
  });

  it('counts only applicable examples in realRoutePassRate', () => {
    const applicableResult = applyCalibrationApplicability({
      id: 'applicable-pass',
      passed: true,
      expectedTechName: 'Joseph Willey',
      actualTopTechName: 'Joseph Willey',
      expectedRank: 1,
      acceptedRankMax: 1,
      topMatches: [],
      failureReason: null,
      dispatcherReason: 'ok',
      notes: '',
      technicianCount: 2,
      routeDate: '2026-06-06',
      routeTechnicianCount: 2,
      topTechStopCount: 3,
      topTechOverPreferredMax: false,
      topTechOverHardMax: false,
      dayMismatchWarnings: [],
      topCandidates: [],
    }, {
      applicable: true,
      skipReason: null,
      skipLabel: null,
      territoryRepresented: true,
      acceptableTechScheduled: true,
      routeDateMismatch: false,
    });

    const skippedResult = applyCalibrationApplicability({
      id: 'skipped-example',
      passed: false,
      expectedTechName: 'Cole Chenard',
      actualTopTechName: 'Joseph Willey',
      expectedRank: null,
      acceptedRankMax: 1,
      topMatches: [],
      failureReason: 'Expected technician not found in top 3',
      dispatcherReason: 'sanford',
      notes: '',
      technicianCount: 2,
      routeDate: '2026-06-06',
      routeTechnicianCount: 2,
      topTechStopCount: 3,
      topTechOverPreferredMax: false,
      topTechOverHardMax: false,
      dayMismatchWarnings: [],
      topCandidates: [],
    }, {
      applicable: false,
      skipReason: 'expected_territory_not_represented',
      skipLabel: 'Expected territory not represented in selected cache',
      territoryRepresented: false,
      acceptableTechScheduled: false,
      routeDateMismatch: false,
    });

    const summary = summarizeRealRouteCalibrationResults([applicableResult, skippedResult]);

    expect(summary.realRouteApplicableCount).toBe(1);
    expect(summary.realRouteSkippedCount).toBe(1);
    expect(summary.passRate).toBe(1);
    expect(summary.skippedExamples[0].skipReason).toBe('expected_territory_not_represented');
  });

  it('skips when expected and winning technicians are both not scheduled on route date', () => {
    const windhamExample = getValidationExampleById('windham-general-example-024');
    expect(windhamExample).toBeTruthy();

    const technicians = [
      {
        techName: 'Paige Bullock',
        stops: [{ address: '100 Main St, Westbrook, ME' }],
      },
      {
        techName: 'Ian Pratt',
        stops: [{ address: '220 US Route 1, Scarborough, ME' }],
      },
    ];

    expect(isTechnicianScheduledOnRoute(technicians, 'Chris McGary')).toBe(false);
    expect(isTechnicianScheduledOnRoute(technicians, 'Skyler Ruest')).toBe(false);
    expect(isAcceptableTechScheduled(technicians, windhamExample)).toBe(true);

    expect(shouldSkipExpectedCorridorOwnerNotScheduled(
      windhamExample,
      technicians,
      'Skyler Ruest',
    )).toBe(true);

    const applicability = evaluateCalibrationApplicability(windhamExample, {
      technicians,
      selectedRouteDate: '2026-06-04',
      actualTopTechName: 'Skyler Ruest',
    });

    expect(applicability.applicable).toBe(false);
    expect(applicability.skipReason).toBe('expected_corridor_owner_not_scheduled');
    expect(applicability.skipLabel).toBe('Skipped — expected corridor owner not scheduled');
  });

  it('does not corridor-owner skip when the winning technician is scheduled', () => {
    const windhamExample = getValidationExampleById('windham-general-example-024');
    const technicians = [
      {
        techName: 'Skyler Ruest',
        stops: [{ address: '770 Roosevelt Trail, Windham, ME' }],
      },
      {
        techName: 'Paige Bullock',
        stops: [{ address: '100 Main St, Westbrook, ME' }],
      },
    ];

    const applicability = evaluateCalibrationApplicability(windhamExample, {
      technicians,
      selectedRouteDate: '2026-06-04',
      actualTopTechName: 'Skyler Ruest',
    });

    expect(applicability.applicable).toBe(true);
    expect(applicability.skipReason).toBeNull();
  });
});
