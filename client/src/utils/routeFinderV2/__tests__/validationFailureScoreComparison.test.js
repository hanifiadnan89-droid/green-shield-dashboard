import { describe, it, expect } from 'vitest';
import {
  buildFailureScoreComparison,
  buildTechnicianScoreSnapshot,
  explainWhyWinnerBeatExpected,
  formatFailureScoreComparisonTable,
  sumModifierPoints,
} from '../validationFailureScoreComparison.js';
import { getValidationExamples } from '../validationExamples.js';
import { scoreSingleDateV2 } from '../../routeFinderScoringV2.js';
import { buildHighConfidenceFailureComparisonsWithRescore } from '../buildHighConfidenceFailureComparisons.js';
import { MOCK_REAL_ROUTE_PAYLOADS } from '../testFixtures/realRouteCalibration.fixture.js';

describe('validationFailureScoreComparison', () => {
  it('extracts requested modifier buckets from v2 score metadata', () => {
    const snapshot = buildTechnicianScoreSnapshot({
      techName: 'Joseph Willey',
      scores: { total: 80, geographic: 70, travelEfficiency: 60, timeWindow: 100, workload: 80, serviceDuration: 90, capacity: 85, insertionProximity: 75, routeAreaBonus: 0, workloadPenalty: 0 },
      v2Score: {
        baseTotal: 80,
        adjustedTotal: 92,
        adjustment: 12,
        bonuses: [
          { code: 'strong_geo_cluster', label: 'Strong geo cluster', points: 5 },
          { code: 'same_town_match', label: 'Same town match', points: 6 },
          { code: 'nearby_route_stop_same_town', label: 'Nearby route stop in same town', points: 4 },
          { code: 'normal_service_area_match', label: 'Job in technician normal service area', points: 5 },
        ],
        penalties: [],
      },
      v2Profile: { eligibilityStatus: 'eligible' },
    }, 1, []);

    expect(snapshot.geoClusterBonus).toBe(5);
    expect(snapshot.sameTownBonus).toBe(6);
    expect(snapshot.nearbyRouteBonus).toBe(4);
    expect(snapshot.normalServiceAreaBonus).toBe(5);
    expect(snapshot.baseScoreBreakdown.geographic).toBe(70);
  });

  it('explains why the winner beat the expected technician', () => {
    const explanation = explainWhyWinnerBeatExpected(
      {
        techName: 'Joseph Willey',
        rank: 2,
        baseTotal: 80,
        adjustedTotal: 85,
        adjustment: 5,
        baseScoreBreakdown: { geographic: 70, travelEfficiency: 60, timeWindow: 100, workload: 80, serviceDuration: 90, capacity: 85, insertionProximity: 75, routeAreaBonus: 0, workloadPenalty: 0, total: 80 },
        geoClusterBonus: 0,
        geoClusterPenalty: 8,
        sameTownBonus: 6,
        nearbyRouteBonus: 4,
        normalServiceAreaBonus: 5,
        backtrackingPenalty: 0,
        stopLoadPenalty: 0,
        stopCount: 3,
        eligibilityStatus: 'eligible',
        bonuses: [],
        penalties: [{ code: 'weak_geo_cluster', label: 'Weak', points: 8 }],
        explanation: '',
      },
      {
        techName: 'Ian Pratt',
        rank: 1,
        baseTotal: 88,
        adjustedTotal: 96,
        adjustment: 8,
        baseScoreBreakdown: { geographic: 82, travelEfficiency: 70, timeWindow: 100, workload: 80, serviceDuration: 90, capacity: 85, insertionProximity: 80, routeAreaBonus: 0, workloadPenalty: 0, total: 88 },
        geoClusterBonus: 5,
        geoClusterPenalty: 0,
        sameTownBonus: 0,
        nearbyRouteBonus: 0,
        normalServiceAreaBonus: 0,
        backtrackingPenalty: 0,
        stopLoadPenalty: 0,
        stopCount: 5,
        eligibilityStatus: 'eligible',
        bonuses: [{ code: 'strong_geo_cluster', label: 'Strong', points: 5 }],
        penalties: [],
        explanation: '',
      },
    );

    expect(explanation).toMatch(/base total \+8/);
    expect(explanation).toMatch(/geo cluster/);
  });

  it('builds high-confidence comparison rows from real-route mock payload', async () => {
    const example = getValidationExamples().find(row => row.id === 'kennebunk-iq-example-002');
    expect(example).toBeTruthy();

    const technicians = MOCK_REAL_ROUTE_PAYLOADS['2026-06-17'].technicians;
    const bundle = await scoreSingleDateV2(technicians, {
      address: example.newJob.address,
      lat: example.newJob.lat,
      lng: example.newJob.lng,
      serviceType: example.newJob.serviceType,
      timeWindowPreference: example.newJob.timePreference,
      routeArea: example.newJob.routeArea ?? 'maine',
      date: example.date,
    }, technicians.length, { prefetchTravel: false });

    const failure = {
      id: example.id,
      routeDate: '2026-06-17',
      expectedTechName: example.expectedTechName,
      actualTopTechName: bundle.result.topMatches[0]?.techName ?? null,
      dispatcherConfidence: 'high',
      failureClassification: 'true_routing_mistake',
    };

    const comparisons = await buildHighConfidenceFailureComparisonsWithRescore({
      failures: [failure],
      examples: [example],
      techniciansByExampleId: { [example.id]: technicians },
      scoreExample: async (_example, lead, techs, topN) => {
        const scored = await scoreSingleDateV2(techs, lead, topN, { prefetchTravel: false });
        return scored.result;
      },
    });

    expect(comparisons).toHaveLength(1);
    expect(comparisons[0].expected?.techName).toBe('Joseph Willey');
    expect(comparisons[0].winner?.techName).toBeTruthy();
    expect(comparisons[0].finalScoreDelta).not.toBeNull();

    const table = formatFailureScoreComparisonTable(comparisons);
    expect(table).toContain('expected technician');
    expect(table).toContain('winning technician');
    expect(table).toContain('geo cluster bonus');
    expect(table).toContain('final score delta');
  });

  it('sums modifier points by code list', () => {
    expect(sumModifierPoints(
      [{ code: 'backtracking_risk', points: 10 }, { code: 'over_preferred_max_stops', points: 6 }],
      ['backtracking_risk'],
    )).toBe(10);
  });

  it('builds a comparison object for expected vs winner', async () => {
    const example = getValidationExamples()[0];
    const technicians = MOCK_REAL_ROUTE_PAYLOADS['2026-06-17'].technicians;
    const lead = {
      address: example.newJob.address,
      lat: example.newJob.lat,
      lng: example.newJob.lng,
      serviceType: example.newJob.serviceType,
      timeWindowPreference: example.newJob.timePreference,
      routeArea: 'maine',
      date: example.date,
    };
    const scored = await scoreSingleDateV2(technicians, lead, technicians.length, { prefetchTravel: false });
    const comparison = buildFailureScoreComparison(
      example,
      {
        id: example.id,
        routeDate: '2026-06-17',
        expectedTechName: example.expectedTechName,
        actualTopTechName: scored.result.topMatches[0]?.techName ?? null,
        dispatcherConfidence: 'high',
      },
      technicians,
      scored.result,
    );

    expect(comparison.expectedTechName).toBe('Joseph Willey');
    expect(comparison.winner).toBeTruthy();
  });
});
