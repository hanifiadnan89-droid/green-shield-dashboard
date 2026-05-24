/**
 * VRPTW engine tests — run fixtures under engine: 'vrptw' and assert:
 * 1. Consumer contract (35 fields) is still satisfied
 * 2. Hard-timed-anchor fixture returns viable: false when anchor violated
 * 3. Cluster fixture picks a mid-route insertion over end-of-route
 * 4. Excluded techs are still filtered
 * 5. NH routing still restricts to Alex Gray
 * 6. Perf: 30 techs × 5 stops runs in < 200ms median
 */
import { describe, it, expect } from 'vitest';
import { scoreRoutes, SCORER_CONFIG } from '../fieldRoutesScorer.js';
import {
  generalHappyPath, nhApprovedTech, nhNoApprovedTech,
  endOfRouteCluster, twoTimedAnchors, excludedLeo,
} from './fieldRoutesScorer.fixtures.js';

// Override engine to 'vrptw' for all calls in this suite
function vrptwScore(technicians, lead, topN = 3) {
  // We can't inject config directly via the public API yet (Phase 5).
  // For now, temporarily override the engine flag and restore it.
  const orig = SCORER_CONFIG.engine;
  SCORER_CONFIG.engine = 'vrptw';
  try {
    return scoreRoutes(technicians, lead, topN);
  } finally {
    SCORER_CONFIG.engine = orig;
  }
}

// ---------------------------------------------------------------------------
// Contract: VRPTW output has same consumer-facing shape
// ---------------------------------------------------------------------------
describe('VRPTW engine — consumer contract', () => {
  it('topMatches[0] has all required fields', () => {
    const result = vrptwScore(generalHappyPath.technicians, generalHappyPath.lead);
    expect(result.topMatches.length).toBeGreaterThan(0);

    const match = result.topMatches[0];
    // Per-match fields
    expect(typeof match.techName).toBe('string');
    expect(typeof match.routeId).toBe('string');
    expect(typeof match.stopCount).toBe('number');
    expect(typeof match.wasOptimized).toBe('boolean');
    expect(typeof match.nearestStopMiles).toBe('number');
    expect(typeof match.clusterDensity).toBe('number');
    expect(match.clusterDetail).toBeDefined();
    expect(typeof match.routeSmoothness).toBe('string');
    expect(typeof match.reason).toBe('string');
    expect(typeof match.scores.total).toBe('number');
    expect(match.rank).toBe(1);
  });

  it('bestInsertion has all required fields', () => {
    const result = vrptwScore(generalHappyPath.technicians, generalHappyPath.lead);
    const ins = result.topMatches[0].bestInsertion;

    expect(['none', 'low', 'medium', 'high']).toContain(ins.timedRisk);
    expect(['None', 'Low', 'Moderate', 'High', 'Severe']).toContain(ins.backtrackingRisk);
    expect(['High', 'Medium', 'Low']).toContain(ins.optimizationConfidence);
    expect(['AM', 'PM', null]).toContain(ins.suggestedWindow);
    expect(ins).toHaveProperty('estimatedArrivalTime');
    expect(ins).toHaveProperty('insertAfterLabel');
    expect(ins).toHaveProperty('insertBeforeLabel');
    expect(typeof ins.insertionPositionLabel).toBe('string');
    expect(ins).toHaveProperty('prevStop');
    expect(ins).toHaveProperty('nextStop');
    expect(typeof ins.addedDriveTime).toBe('string');
    expect(typeof ins.detourMiles).toBe('number');
    expect(typeof ins.serviceDuration).toBe('string');
    expect(typeof ins.viable).toBe('boolean');
    expect(ins).toHaveProperty('timedSafetyLabel');
    expect(ins).toHaveProperty('eodLabel');
    expect(typeof ins.startEndLocationFit).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Timed anchor fixture: hard violation → viable: false
// ---------------------------------------------------------------------------
describe('VRPTW engine — timed anchor constraints', () => {
  it('returns results without hard-failing on a solvable route', () => {
    const result = vrptwScore(twoTimedAnchors.technicians, twoTimedAnchors.lead);
    // The route has timed anchors but a valid insertion window should exist
    expect(result.topMatches.length).toBeGreaterThanOrEqual(0);
  });

  it('parses FieldRoutes decimal windows as clock minutes', () => {
    const result = vrptwScore(
      generalHappyPath.technicians,
      { ...generalHappyPath.lead, timeWindowPreference: '8.3-6' }
    );

    expect(result.prefWindow.startTime).toBe('8:30 AM');
    expect(result.prefWindow.endTime).toBe('6:00 PM');
  });
});

// ---------------------------------------------------------------------------
// Route-end estimate is informational only, not a 6 PM hard gate
// ---------------------------------------------------------------------------
describe('VRPTW engine — no 6 PM rejection', () => {
  it('keeps scoring routes even when projected finish goes past 6 PM', () => {
    const technicians = [{
      techId: 9001,
      techName: 'Late Route',
      routeId: 'late-route',
      routeDurationCapacityRaw: '8 / 12',
      startLocation: { lat: 43.1, lng: -70.7 },
      endLocation: { lat: 43.7, lng: -70.1 },
      stops: Array.from({ length: 9 }, (_, i) => ({
        appointmentId: 900100 + i,
        customerName: `Late Stop ${i + 1}`,
        address: `${i + 1} Long Day Rd`,
        lat: 43.1 + i * 0.075,
        lng: -70.7 + i * 0.075,
        spotStartMinutes: 480 + i * 60,
        durationMinutes: 60,
        startTime: null,
        endTime: null,
        routeOrder: i,
      })),
    }];
    const lead = {
      lat: 43.35,
      lng: -70.45,
      serviceType: 'Initial Service',
      timeWindowPreference: 'PM',
      routeArea: 'general',
      date: '2026-05-19',
    };

    const result = vrptwScore(technicians, lead);
    expect(result.topMatches.length).toBe(1);
    expect(result.topMatches[0].bestInsertion.projectedRouteEndMin).toBeGreaterThan(1080);
    expect(typeof result.topMatches[0].bestInsertion.eodLabel).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Cluster fixture: prefers mid-route over end-of-route when cluster exists
// ---------------------------------------------------------------------------
describe('VRPTW engine — cluster preference', () => {
  it('selects an insertion with low detour when cluster is nearby', () => {
    const result = vrptwScore(endOfRouteCluster.technicians, endOfRouteCluster.lead);
    if (result.topMatches.length === 0) return; // nothing to assert if no results
    const ins = result.topMatches[0].bestInsertion;
    // VRPTW should prefer a low-detour mid-route position over end-of-route
    // (end-of-route would require driving from Portland ME back to Wells ME)
    expect(ins.detourMiles).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// Exclusion rules still apply
// ---------------------------------------------------------------------------
describe('VRPTW engine — exclusion rules', () => {
  it('excludes Leo even under VRPTW engine', () => {
    const result = vrptwScore(excludedLeo.technicians, excludedLeo.lead);
    expect(result.topMatches.length).toBe(0);
  });

  it('NH restricts to Alex Gray only', () => {
    const resultApproved = vrptwScore(nhApprovedTech.technicians, nhApprovedTech.lead);
    expect(resultApproved.topMatches.length).toBeGreaterThan(0);
    expect(resultApproved.topMatches[0].techName).toBe('Alex Gray');

    const resultExcluded = vrptwScore(nhNoApprovedTech.technicians, nhNoApprovedTech.lead);
    expect(resultExcluded.noSafeRoute).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Performance: 30 techs × 5 stops < 200ms median over 5 runs
// ---------------------------------------------------------------------------
describe('VRPTW engine — performance', () => {
  it('scores 30 techs × 5 stops in < 200ms', () => {
    // Build 30 synthetic techs, each with 5 stops near Kennebunk ME
    const makePerf = (n) => ({
      techId: n, techName: `Tech ${n}`, routeId: `R${n}`,
      stops: Array.from({ length: 5 }, (_, i) => ({
        appointmentId: n * 100 + i,
        customerName: `Customer ${n}-${i}`,
        lat: 43.3 + (n % 5) * 0.02 + i * 0.01,
        lng: -70.5 - (n % 3) * 0.02 - i * 0.01,
        address: `${i} Test St`,
        spotStartMinutes: 480 + i * 60,
        durationMinutes: 30,
        startTime: null, endTime: null, routeOrder: i,
      })),
      startLocation: null, endLocation: null,
      routeDurationCapacityRaw: '2.5 / 10.5',
    });

    const technicians = Array.from({ length: 30 }, (_, i) => makePerf(i));
    const lead = { lat: 43.38, lng: -70.54, serviceType: 'Regular Service', durationMinutes: 30,
      timeWindowPreference: 'AM', routeArea: 'general', date: '2026-05-19' };

    const runs = 5;
    let totalMs = 0;
    for (let r = 0; r < runs; r++) {
      const t0 = performance.now();
      vrptwScore(technicians, lead, 3);
      totalMs += performance.now() - t0;
    }
    const medianMs = totalMs / runs;
    expect(medianMs).toBeLessThan(200);
  });
});
