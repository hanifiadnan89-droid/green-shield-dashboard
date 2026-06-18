/**
 * Contract test — structural firewall for Route Finder V2 scoring scaffold.
 *
 * Verifies that scoreSingleDate() with V2 enabled returns the same enriched
 * fields the UI consumes (topMatches, trust badges, insertion, routeStops, etc.).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { scoreSingleDate, SCORING_MODES } from '../routeFinderScoring.js';
import {
  isRouteFinderV2ScoringEnabled,
  scoreSingleDateV2,
} from '../routeFinderScoringV2.js';
import { generalHappyPath, nhNoApprovedTech, nhApprovedTech } from './fieldRoutesScorer.fixtures.js';

function assertEnrichedTopLevelResult(result) {
  expect(result.mode).toBe(SCORING_MODES.SINGLE_DATE);
  expect(result).toHaveProperty('routeArea');
  expect(result).toHaveProperty('totalRoutesScored');
  expect(typeof result.totalRoutesScored).toBe('number');
  expect(result).toHaveProperty('prefWindow');
  expect(result.prefWindow).toHaveProperty('label');
  expect(result.prefWindow).toHaveProperty('startTime');
  expect(result.prefWindow).toHaveProperty('endTime');
  expect(Array.isArray(result.topMatches)).toBe(true);
  expect(result).toHaveProperty('recommendation');
  expect(Array.isArray(result.alternatives)).toBe(true);
  if (result.topMatches.length > 0) {
    expect(result.recommendation).toEqual(result.topMatches[0]);
    expect(result.alternatives).toEqual(result.topMatches.slice(1));
  }
}

function assertUiMatchContract(match) {
  expect(typeof match.techName).toBe('string');
  expect(typeof match.routeId).toBe('string');
  expect(typeof match.scores.total).toBe('number');
  expect(match.bestInsertion).toBeDefined();
  expect(typeof match.bestInsertion).toBe('object');
  expect(match.closestStop).toBeDefined();
  expect(typeof match.clusterLabel).toBe('string');
  expect(match.routeFeasibility).toBeDefined();
  expect(typeof match.reason).toBe('string');
  expect(match.workload).toBeDefined();
  expect(Array.isArray(match.trustBadges)).toBe(true);
  expect(match.costImpact).toBeDefined();
  expect(['High', 'Medium', 'Low']).toContain(match.confidenceLabel);
  expect(Array.isArray(match.routeStops)).toBe(true);
  expect(match.routeStops.length).toBeGreaterThan(0);
}

function assertV2ProfileContract(profile) {
  expect(typeof profile.matched).toBe('boolean');
  expect(profile.profileTechName === null || typeof profile.profileTechName === 'string').toBe(true);
  expect(['eligible', 'warning', 'disqualified']).toContain(profile.eligibilityStatus);
  expect(typeof profile.profileFitScore).toBe('number');
  expect(Array.isArray(profile.warnings)).toBe(true);
  expect(typeof profile.overPreferredMaxStops).toBe('boolean');
  expect(typeof profile.overHardMaxStops).toBe('boolean');
}

function assertV2ScoreContract(v2Score, match) {
  expect(typeof v2Score.baseTotal).toBe('number');
  expect(typeof v2Score.adjustedTotal).toBe('number');
  expect(typeof v2Score.adjustment).toBe('number');
  expect(v2Score.baseTotal).toBe(match.scores.total);
  expect(v2Score.adjustedTotal).toBe(v2Score.baseTotal + v2Score.adjustment);
  expect(Array.isArray(v2Score.penalties)).toBe(true);
  expect(Array.isArray(v2Score.bonuses)).toBe(true);
  expect(typeof v2Score.explanation).toBe('string');
  for (const penalty of v2Score.penalties) {
    expect(typeof penalty.code).toBe('string');
    expect(typeof penalty.label).toBe('string');
    expect(typeof penalty.points).toBe('number');
  }
  for (const bonus of v2Score.bonuses) {
    expect(typeof bonus.code).toBe('string');
    expect(typeof bonus.label).toBe('string');
    expect(typeof bonus.points).toBe('number');
  }
}

describe('routeFinderScoringV2 feature flag', () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('isRouteFinderV2ScoringEnabled respects VITE_ROUTE_FINDER_V2_SCORING', () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', '');
    expect(isRouteFinderV2ScoringEnabled()).toBe(false);

    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');
    expect(isRouteFinderV2ScoringEnabled()).toBe(true);

    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', '1');
    expect(isRouteFinderV2ScoringEnabled()).toBe(true);
  });
});

describe('scoreSingleDateV2 — raw scorer contract', () => {
  let rawBundle;

  beforeAll(async () => {
    rawBundle = await scoreSingleDateV2(
      generalHappyPath.technicians,
      generalHappyPath.lead,
      3,
      { prefetchTravel: false },
    );
  });

  it('returns v2 bundle with result, travelCtx, stagingDiagnostics, scoringEngine', () => {
    expect(rawBundle.scoringEngine).toBe('v2');
    expect(rawBundle.scoringSource).toBe('v2-haversine-only');
    expect(rawBundle.result).toBeDefined();
    expect(rawBundle.result).toHaveProperty('topMatches');
    expect(Array.isArray(rawBundle.result.topMatches)).toBe(true);
    expect(rawBundle.result.topMatches.length).toBeGreaterThan(0);
    assertV2ProfileContract(rawBundle.result.topMatches[0].v2Profile);
    assertV2ScoreContract(rawBundle.result.topMatches[0].v2Score, rawBundle.result.topMatches[0]);
  });
});

describe('scoreSingleDate with V2 enabled — enriched UI contract', () => {
  let result;
  let match;

  beforeAll(async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');
    result = await scoreSingleDate(
      generalHappyPath.technicians,
      generalHappyPath.lead,
      3,
      { prefetchTravel: false },
    );
    match = result.topMatches[0];
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('returns enriched single-date result shape', () => {
    assertEnrichedTopLevelResult(result);
    expect(result.topMatches.length).toBeGreaterThan(0);
  });

  it('top match exposes UI-required fields', () => {
    assertUiMatchContract(match);
    expect(match.rank).toBe(1);
    expect(match.matchId).toContain('::');
    expect(Array.isArray(match.trustWarnings)).toBe(true);
    assertV2ProfileContract(match.v2Profile);
    assertV2ScoreContract(match.v2Score, match);
    expect(match.v2Profile.eligibilityStatus).toBe('warning');
    expect(match.v2Profile.warnings).toContain('Missing technician profile');
  });

  it('bestInsertion exposes ResultCard fields', () => {
    const ins = match.bestInsertion;
    expect(['none', 'low', 'medium', 'high']).toContain(ins.timedRisk);
    expect(['None', 'Low', 'Moderate', 'High', 'Severe']).toContain(ins.backtrackingRisk);
    expect(typeof ins.insertionPositionLabel).toBe('string');
    expect(typeof ins.addedDriveTime).toBe('string');
    expect(typeof ins.detourMiles).toBe('number');
    expect(typeof ins.serviceDuration).toBe('string');
    expect(ins).toHaveProperty('prevStop');
    expect(ins).toHaveProperty('nextStop');
  });
});

describe('scoreSingleDate with V2 enabled — noSafeRoute contract', () => {
  let result;

  beforeAll(async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');
    result = await scoreSingleDate(
      nhNoApprovedTech.technicians,
      nhNoApprovedTech.lead,
      3,
      { prefetchTravel: false },
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('preserves noSafeRoute envelope', () => {
    expect(result.noSafeRoute).toBe(true);
    expect(typeof result.noSafeRouteMessage).toBe('string');
    expect(result.topMatches).toEqual([]);
    expect(result.recommendation).toBeNull();
    expect(result.alternatives).toEqual([]);
  });
});

describe('scoreSingleDate with V2 enabled — technician profile enrichment', () => {
  let result;
  let match;

  beforeAll(async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');
    result = await scoreSingleDate(
      nhApprovedTech.technicians,
      nhApprovedTech.lead,
      3,
      { prefetchTravel: false },
    );
    match = result.topMatches[0];
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('attaches matched v2Profile for known technicians', () => {
    assertUiMatchContract(match);
    assertV2ProfileContract(match.v2Profile);
    expect(match.v2Profile.matched).toBe(true);
    expect(match.v2Profile.profileTechName).toBe('Alex Gray');
    expect(match.v2Profile.serviceCapabilityMatch).toBe(true);
    expect(match.v2Profile.eligibilityStatus).toBe('eligible');
  });
});

describe('scoreSingleDate legacy path — no v2 metadata', () => {
  let result;

  beforeAll(async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', '');
    result = await scoreSingleDate(
      generalHappyPath.technicians,
      generalHappyPath.lead,
      3,
      { prefetchTravel: false },
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('does not attach v2Profile or v2Score when V2 flag is disabled', () => {
    expect(result.topMatches[0].v2Profile).toBeUndefined();
    expect(result.topMatches[0].v2Score).toBeUndefined();
  });
});
