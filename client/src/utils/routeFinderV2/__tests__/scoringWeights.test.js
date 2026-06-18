import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as routeFinderV2Config from '../index.js';
import {
  V2_SCORING_WEIGHTS,
  V2_PENALTY_CONFIG,
  getV2ScoringWeights,
  getV2PenaltyConfig,
  sumV2ScoringWeights,
} from '../scoringWeights.js';
import { scoreSingleDate } from '../../routeFinderScoring.js';
import { generalHappyPath, nhNoApprovedTech } from '../../__tests__/fieldRoutesScorer.fixtures.js';

function stripMatchForParity(match) {
  if (!match) return match;
  const { matchId, v2Profile, ...matchRest } = match;
  return {
    ...matchRest,
    scores: match.scores ? { ...match.scores } : match.scores,
  };
}

function stripV2ProfileFields(result) {
  if (!result) return result;
  const { generatedAt, ...rest } = result;
  const topMatches = (rest.topMatches ?? []).map(stripMatchForParity);
  return {
    ...rest,
    topMatches,
    recommendation: stripMatchForParity(rest.recommendation),
    alternatives: (rest.alternatives ?? []).map(stripMatchForParity),
    allScores: (rest.allScores ?? []).map(({ v2Profile, ...entry }) => ({ ...entry })),
  };
}

describe('routeFinderV2 config barrel', () => {
  it('imports all config modules successfully', () => {
    expect(routeFinderV2Config.TECHNICIAN_PROFILES.length).toBeGreaterThan(0);
    expect(routeFinderV2Config.SERVICE_DURATION_RULES.length).toBeGreaterThan(0);
    expect(routeFinderV2Config.TIME_WINDOW_RULES.ANYTIME).toBeDefined();
    expect(routeFinderV2Config.V2_SCORING_WEIGHTS).toBeDefined();
    expect(routeFinderV2Config.V2_PENALTY_CONFIG).toBeDefined();
    expect(routeFinderV2Config.REGION_RULES.maine).toBeDefined();
    expect(routeFinderV2Config.PRIORITY_RULES.length).toBeGreaterThan(0);
    expect(routeFinderV2Config.ROUTE_FINDER_VALIDATION_EXAMPLES).toEqual([]);
    expect(typeof routeFinderV2Config.getRegionRule).toBe('function');
    expect(typeof routeFinderV2Config.getPriorityRule).toBe('function');
    expect(typeof routeFinderV2Config.getValidationExamples).toBe('function');
    expect(typeof routeFinderV2Config.buildMatchV2Profile).toBe('function');
    expect(typeof routeFinderV2Config.enrichScoringResultWithV2Profiles).toBe('function');
  });
});

describe('scoringWeights', () => {
  it('V2 scoring weights sum to 1.0', () => {
    expect(sumV2ScoringWeights(V2_SCORING_WEIGHTS)).toBeCloseTo(1.0, 5);
    expect(sumV2ScoringWeights(getV2ScoringWeights())).toBeCloseTo(1.0, 5);
  });

  it('defines initial weight structure', () => {
    expect(V2_SCORING_WEIGHTS).toEqual({
      driveImpact: 0.30,
      timeWindowFit: 0.20,
      workloadFit: 0.20,
      geoClusterFit: 0.15,
      technicianProfileFit: 0.10,
      routeDamage: 0.05,
    });
  });

  it('defines penalty config', () => {
    expect(V2_PENALTY_CONFIG).toEqual({
      overPreferredStopPenalty: 8,
      overHardStopDisqualify: true,
      outsideServiceAreaPenalty: 12,
      backtrackingPenalty: 10,
      weakGeoClusterPenalty: 8,
      missingTechnicianProfilePenalty: 15,
      missingCoordinatesPenalty: 100,
    });
    expect(getV2PenaltyConfig()).toEqual(V2_PENALTY_CONFIG);
    expect(getV2ScoringWeights()).not.toBe(V2_SCORING_WEIGHTS);
  });
});

describe('routeFinderV2 config layer — scoring parity', () => {
  describe('scoreSingleDate parity (legacy vs V2 flag)', () => {
    let legacyResult;
    let v2Result;

    beforeAll(async () => {
      vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', '');
      legacyResult = await scoreSingleDate(
        generalHappyPath.technicians,
        generalHappyPath.lead,
        3,
        { prefetchTravel: false },
      );

      vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');
      v2Result = await scoreSingleDate(
        generalHappyPath.technicians,
        generalHappyPath.lead,
        3,
        { prefetchTravel: false },
      );
    });

    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it('preserves legacy scoring fields when V2 metadata is stripped', () => {
      expect(stripV2ProfileFields(v2Result)).toEqual(stripV2ProfileFields(legacyResult));
    });

    it('adds v2Profile metadata only on the V2 path', () => {
      expect(v2Result.topMatches[0].v2Profile).toBeDefined();
      expect(legacyResult.topMatches[0].v2Profile).toBeUndefined();
    });
  });

  describe('noSafeRoute parity', () => {
    let legacyResult;
    let v2Result;

    beforeAll(async () => {
      vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', '');
      legacyResult = await scoreSingleDate(
        nhNoApprovedTech.technicians,
        nhNoApprovedTech.lead,
        3,
        { prefetchTravel: false },
      );

      vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');
      v2Result = await scoreSingleDate(
        nhNoApprovedTech.technicians,
        nhNoApprovedTech.lead,
        3,
        { prefetchTravel: false },
      );
    });

    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it('preserves noSafeRoute behavior with V2 flag enabled', () => {
      expect(stripV2ProfileFields(v2Result)).toEqual(stripV2ProfileFields(legacyResult));
    });
  });
});
