import { describe, it, expect } from 'vitest';
import {
  applyCalibrationApplicability,
  evaluateCalibrationApplicability,
  isAcceptableTechScheduled,
  isTerritoryRepresentedInCache,
  profileCoversLeadTown,
  summarizeRealRouteCalibrationResults,
} from '../validationCalibrationApplicability.js';
import { getValidationExamples } from '../validationExamples.js';
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
});
