import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const routeFinderScoringV2Path = join(__dirname, '../../routeFinderScoringV2.js');

function comparableScoringSnapshot(result) {
  if (!result) return result;
  const { generatedAt, ...rest } = result;
  return {
    ...rest,
    topMatches: (rest.topMatches ?? []).map((match) => {
      const { matchId, ...matchRest } = match;
      return {
        ...matchRest,
        scores: match.scores ? { ...match.scores } : match.scores,
      };
    }),
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

describe('routeFinderV2 config layer — no live scoring changes', () => {
  it('routeFinderScoringV2 does not import V2 config yet', () => {
    const source = readFileSync(routeFinderScoringV2Path, 'utf8');
    expect(source).not.toMatch(/routeFinderV2/);
  });

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

    it('produces identical scoring output when V2 flag is enabled', () => {
      expect(comparableScoringSnapshot(v2Result)).toEqual(comparableScoringSnapshot(legacyResult));
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
      expect(comparableScoringSnapshot(v2Result)).toEqual(comparableScoringSnapshot(legacyResult));
    });
  });
});
