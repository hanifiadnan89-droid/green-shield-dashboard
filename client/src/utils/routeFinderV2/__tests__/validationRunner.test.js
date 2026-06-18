import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  evaluateValidationExample,
  buildValidationTopMatchDiagnostic,
  buildLeadFromValidationExample,
  printValidationResult,
  resolveAcceptableTechNames,
} from '../validationRunner.js';
import { ROUTE_FINDER_VALIDATION_EXAMPLES } from '../validationExamples.js';
import { scoreSingleDateV2 } from '../../routeFinderScoringV2.js';
import { scoreSingleDate } from '../../routeFinderScoring.js';
import { generalHappyPath } from '../../__tests__/fieldRoutesScorer.fixtures.js';
import { kennebunkIqValidationFixture } from '../testFixtures/validationExamples.fixture.js';

function makeExample(overrides = {}) {
  return {
    id: 'test-example',
    date: '2026-06-17',
    newJob: {
      address: '123 Main St, Kennebunk, ME',
      lat: 43.3845,
      lng: -70.5448,
      serviceType: 'IQ',
      timePreference: 'Anytime',
    },
    expectedTechName: 'Joseph Willey',
    dispatcherReason: 'Dispatcher-approved route.',
    notes: 'Test notes.',
    ...overrides,
  };
}

function makeMatch(techName, rankData = {}) {
  return {
    techName,
    routeId: `R-${techName}`,
    scores: { total: rankData.baseTotal ?? 80 },
    v2Score: {
      baseTotal: rankData.baseTotal ?? 80,
      adjustedTotal: rankData.adjustedTotal ?? 80,
      adjustment: rankData.adjustment ?? 0,
      penalties: rankData.penalties ?? [],
      bonuses: rankData.bonuses ?? [],
      explanation: rankData.explanation ?? '',
    },
    v2Profile: {
      eligibilityStatus: rankData.eligibilityStatus ?? 'eligible',
      warnings: rankData.warnings ?? [],
    },
  };
}

function makeScoringResult(topMatches) {
  return {
    topMatches,
    recommendation: topMatches[0] ?? null,
    alternatives: topMatches.slice(1),
  };
}

describe('validationRunner', () => {
  it('passes when expected tech is ranked #1', () => {
    const example = makeExample();
    const scoringResult = makeScoringResult([
      makeMatch('Joseph Willey', { adjustedTotal: 95 }),
      makeMatch('Ian Pratt', { adjustedTotal: 70 }),
      makeMatch('Paige Bullock', { adjustedTotal: 65 }),
    ]);

    const result = evaluateValidationExample(example, [], scoringResult);

    expect(result.passed).toBe(true);
    expect(result.expectedRank).toBe(1);
    expect(result.actualTopTechName).toBe('Joseph Willey');
    expect(result.failureReason).toBeNull();
  });

  it('passes when expected tech is within acceptedRankMax', () => {
    const example = makeExample({ acceptedRankMax: 2 });
    const scoringResult = makeScoringResult([
      makeMatch('Ian Pratt', { adjustedTotal: 95 }),
      makeMatch('Joseph Willey', { adjustedTotal: 90 }),
      makeMatch('Paige Bullock', { adjustedTotal: 65 }),
    ]);

    const result = evaluateValidationExample(example, [], scoringResult);

    expect(result.passed).toBe(true);
    expect(result.expectedRank).toBe(2);
    expect(result.acceptedRankMax).toBe(2);
  });

  it('fails when expected tech is missing from top matches', () => {
    const example = makeExample();
    const scoringResult = makeScoringResult([
      makeMatch('Ian Pratt'),
      makeMatch('Paige Bullock'),
      makeMatch('Jack Johnson'),
    ]);

    const result = evaluateValidationExample(example, [], scoringResult);

    expect(result.passed).toBe(false);
    expect(result.expectedRank).toBeNull();
    expect(result.failureReason).toContain('Expected technician not found');
  });

  it('fails when a forbidden tech is ranked #1', () => {
    const example = makeExample({
      expectedNotTechNames: ['Ian Pratt', 'Paige Bullock'],
    });
    const scoringResult = makeScoringResult([
      makeMatch('Ian Pratt', { adjustedTotal: 95 }),
      makeMatch('Joseph Willey', { adjustedTotal: 90 }),
    ]);

    const result = evaluateValidationExample(example, [], scoringResult);

    expect(result.passed).toBe(false);
    expect(result.failureReason).toContain('Forbidden technician ranked #1');
  });

  it('includes v2Score diagnostics in topMatches', () => {
    const penalties = [{ code: 'weak_geo_cluster', label: 'Weak cluster', points: 8 }];
    const bonuses = [{ code: 'same_town_match', label: 'Same town', points: 6 }];
    const scoringResult = makeScoringResult([
      makeMatch('Joseph Willey', {
        baseTotal: 80,
        adjustedTotal: 78,
        penalties,
        bonuses,
        explanation: 'Bonuses: Same town (+6); Penalties: Weak cluster (-8)',
      }),
    ]);

    const result = evaluateValidationExample(makeExample(), [], scoringResult);

    expect(result.topMatches[0]).toEqual({
      rank: 1,
      techName: 'Joseph Willey',
      baseTotal: 80,
      adjustedTotal: 78,
      eligibilityStatus: 'eligible',
      penalties,
      bonuses,
      explanation: 'Bonuses: Same town (+6); Penalties: Weak cluster (-8)',
      warnings: [],
    });
  });

  it('includes v2Profile diagnostics in topMatches', () => {
    const scoringResult = makeScoringResult([
      makeMatch('Joseph Willey', {
        eligibilityStatus: 'warning',
        warnings: ['Route exceeds preferred stop limit'],
      }),
    ]);

    const result = evaluateValidationExample(makeExample(), [], scoringResult);

    expect(result.topMatches[0].eligibilityStatus).toBe('warning');
    expect(result.topMatches[0].warnings).toContain('Route exceeds preferred stop limit');
  });

  it('does not mutate scoring result or technician payload', () => {
    const example = makeExample();
    const technicians = [{ techName: 'Joseph Willey', routeId: 'R-1', stops: [] }];
    const topMatches = [makeMatch('Joseph Willey')];
    const scoringResult = makeScoringResult(topMatches);
    const techniciansSnapshot = JSON.stringify(technicians);
    const scoringSnapshot = JSON.stringify(scoringResult);

    evaluateValidationExample(example, technicians, scoringResult);

    expect(JSON.stringify(technicians)).toBe(techniciansSnapshot);
    expect(JSON.stringify(scoringResult)).toBe(scoringSnapshot);
  });

  it('buildValidationTopMatchDiagnostic falls back to legacy scores when v2Score is absent', () => {
    const diagnostic = buildValidationTopMatchDiagnostic({
      techName: 'Alex Smith',
      scores: { total: 88 },
    }, 1);

    expect(diagnostic.baseTotal).toBe(88);
    expect(diagnostic.adjustedTotal).toBe(88);
    expect(diagnostic.eligibilityStatus).toBe('unknown');
  });

  it('resolveAcceptableTechNames defaults to expectedTechName', () => {
    expect(resolveAcceptableTechNames(makeExample())).toEqual(['Joseph Willey']);
    expect(resolveAcceptableTechNames(makeExample({
      acceptableTechNames: ['Joseph Willey', 'Jack Johnson'],
    }))).toEqual(['Joseph Willey', 'Jack Johnson']);
  });

  it('buildLeadFromValidationExample maps newJob fields to a scoring lead', () => {
    const lead = buildLeadFromValidationExample(ROUTE_FINDER_VALIDATION_EXAMPLES[0]);

    expect(lead.address).toBe('123 Main St, Kennebunk, ME');
    expect(lead.lat).toBe(43.3845);
    expect(lead.serviceAbbreviation).toBe('IQ');
    expect(lead.timeWindowPreference).toBe('AT');
    expect(lead.routeArea).toBe('maine');
    expect(lead.date).toBe('2026-06-17');
  });

  it('logs validation diagnostics in DEV via printValidationResult', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    printValidationResult({
      id: 'test',
      passed: true,
      expectedTechName: 'Joseph Willey',
      actualTopTechName: 'Joseph Willey',
      expectedRank: 1,
      acceptedRankMax: 1,
      topMatches: [],
      failureReason: null,
      dispatcherReason: 'reason',
      notes: 'notes',
      technicianCount: 0,
    });

    if (import.meta.env.DEV) {
      expect(debugSpy).toHaveBeenCalledWith(
        '[RouteFinder V2 Validation] PASS test',
        expect.objectContaining({ expectedTechName: 'Joseph Willey' }),
      );
    } else {
      expect(debugSpy).not.toHaveBeenCalled();
    }

    debugSpy.mockRestore();
  });
});

describe('validationRunner — Kennebunk fixture calibration', () => {
  let scoringBundle;

  beforeAll(async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');
    scoringBundle = await scoreSingleDateV2(
      kennebunkIqValidationFixture.technicians,
      kennebunkIqValidationFixture.lead,
      3,
      { prefetchTravel: false },
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('runs against deterministic Kennebunk fixture without throwing', () => {
    const result = evaluateValidationExample(
      ROUTE_FINDER_VALIDATION_EXAMPLES[0],
      kennebunkIqValidationFixture.technicians,
      scoringBundle.result,
    );

    expect(result.topMatches.length).toBeGreaterThan(0);
    expect(result.topMatches[0].baseTotal).toBeGreaterThan(0);
    expect(result.topMatches[0].adjustedTotal).toBeDefined();
    expect(typeof result.passed).toBe('boolean');
    expect(result.technicianCount).toBe(3);
  });
});

describe('validationRunner — legacy scoring unchanged', () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('legacy scoreSingleDate path does not attach validation metadata', async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', '');
    const legacyResult = await scoreSingleDate(
      generalHappyPath.technicians,
      generalHappyPath.lead,
      3,
      { prefetchTravel: false },
    );

    expect(legacyResult.topMatches[0].v2Score).toBeUndefined();
    expect(legacyResult.validation).toBeUndefined();

    const validationResult = evaluateValidationExample(
      makeExample({ expectedTechName: 'Alex Smith' }),
      generalHappyPath.technicians,
      legacyResult,
    );

    expect(validationResult.topMatches[0].adjustedTotal).toBe(legacyResult.topMatches[0].scores.total);
    expect(validationResult.passed).toBe(true);
  });
});
