/**
 * Contract test — structural firewall for fieldRoutesScorer.js
 *
 * Asserts that every field consumed by RouteFinderWidget.jsx / ResultCard
 * is present on the output of scoreRoutes(). This test must stay green
 * through every phase of the rewrite. It does NOT snapshot values —
 * only field presence and type.
 *
 * If this test breaks, the widget will break in production.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { scoreRoutes, detectRouteArea, getDefaultDuration, NH_CONFIG } from '../fieldRoutesScorer.js';
import { generalHappyPath, nhNoApprovedTech } from './fieldRoutesScorer.fixtures.js';

// ---------------------------------------------------------------------------
// Public API exports
// ---------------------------------------------------------------------------
describe('Public exports', () => {
  it('exports getDefaultDuration', () => {
    expect(typeof getDefaultDuration).toBe('function');
    expect(getDefaultDuration('Regular Service')).toBe(30);
    expect(getDefaultDuration('Initial Service')).toBe(60);
    expect(getDefaultDuration('Unknown Type')).toBe(30);
  });

  it('exports NH_CONFIG with expected shape', () => {
    expect(NH_CONFIG).toBeDefined();
    expect(Array.isArray(NH_CONFIG.approvedTechNames)).toBe(true);
    expect(Array.isArray(NH_CONFIG.approvedTechIds)).toBe(true);
    expect(NH_CONFIG.approvedTechNames).toContain('Alex Gray');
  });

  it('exports detectRouteArea', () => {
    expect(typeof detectRouteArea).toBe('function');
    expect(detectRouteArea('123 Main St, MAINE 04000')).toBe('maine');
    expect(detectRouteArea('456 Elm St, NEW HAMPSHIRE 03000')).toBe('new_hampshire');
    expect(detectRouteArea('789 Oak St, MASSACHUSETTS 02000')).toBe('general');
    expect(detectRouteArea('')).toBe('general');
    expect(detectRouteArea(null)).toBe('general');
  });

  it('exports scoreRoutes', () => {
    expect(typeof scoreRoutes).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Top-level result shape
// ---------------------------------------------------------------------------
describe('scoreRoutes — top-level result shape', () => {
  it('always returns routeArea, totalRoutesScored, prefWindow', () => {
    const result = scoreRoutes(generalHappyPath.technicians, generalHappyPath.lead, 3);
    expect(result).toHaveProperty('routeArea');
    expect(result).toHaveProperty('totalRoutesScored');
    expect(typeof result.totalRoutesScored).toBe('number');
    expect(result).toHaveProperty('prefWindow');
    expect(result.prefWindow).toHaveProperty('label');
    expect(result.prefWindow).toHaveProperty('startTime');
    expect(result.prefWindow).toHaveProperty('endTime');
  });

  it('returns topMatches array', () => {
    const result = scoreRoutes(generalHappyPath.technicians, generalHappyPath.lead, 3);
    expect(Array.isArray(result.topMatches)).toBe(true);
    expect(result.topMatches.length).toBeGreaterThan(0);
  });

  it('noSafeRoute result shape when no valid route', () => {
    const result = scoreRoutes(nhNoApprovedTech.technicians, nhNoApprovedTech.lead, 3);
    expect(result.noSafeRoute).toBe(true);
    expect(typeof result.noSafeRouteMessage).toBe('string');
    expect(Array.isArray(result.topMatches)).toBe(true);
    expect(result.topMatches.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Per-match shape (topMatches[0])
// All fields consumed by ResultCard must be present.
// ---------------------------------------------------------------------------
describe('scoreRoutes — per-match shape', () => {
  let match;

  beforeAll(() => {
    const result = scoreRoutes(generalHappyPath.technicians, generalHappyPath.lead, 3);
    match = result.topMatches[0];
  });

  it('has rank', () => {
    expect(match).toHaveProperty('rank');
    expect(match.rank).toBe(1);
  });

  it('has techName, routeId, stopCount, wasOptimized', () => {
    expect(typeof match.techName).toBe('string');
    expect(typeof match.routeId).toBe('string');
    expect(typeof match.stopCount).toBe('number');
    expect(typeof match.wasOptimized).toBe('boolean');
  });

  it('has nearestStopMiles, clusterDensity, clusterLabel', () => {
    expect(typeof match.nearestStopMiles).toBe('number');
    expect(typeof match.clusterDensity).toBe('number');
    expect(typeof match.clusterLabel).toBe('string');
  });

  it('has clusterDetail with label', () => {
    expect(match.clusterDetail).toBeDefined();
    expect(typeof match.clusterDetail.label).toBe('string');
  });

  it('has routeSmoothness', () => {
    expect(typeof match.routeSmoothness).toBe('string');
  });

  it('has closestStop with all required subfields', () => {
    expect(match.closestStop).toBeDefined();
    expect(match.closestStop).toHaveProperty('customerName');
    expect(match.closestStop).toHaveProperty('address');
    expect(typeof match.closestStop.distanceMiles).toBe('number');
    expect(match.closestStop).toHaveProperty('scheduledTime');
    expect(typeof match.closestStop.stopIndex).toBe('number');
  });

  it('has capacity.remainingHours', () => {
    expect(match.capacity).toBeDefined();
    expect(typeof match.capacity.remainingHours).toBe('number');
  });

  it('has reason', () => {
    expect(typeof match.reason).toBe('string');
    expect(match.reason.length).toBeGreaterThan(0);
  });

  it('has scores with all required keys', () => {
    const { scores } = match;
    expect(typeof scores.total).toBe('number');
    expect(typeof scores.geographic).toBe('number');
    expect(typeof scores.travelEfficiency).toBe('number');
    expect(typeof scores.timeWindow).toBe('number');
    expect(typeof scores.capacity).toBe('number');
    expect(typeof scores.insertionProximity).toBe('number');
  });

  it('has bestInsertion object', () => {
    expect(match.bestInsertion).toBeDefined();
    expect(typeof match.bestInsertion).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// bestInsertion shape — all fields consumed by ResultCard
// ---------------------------------------------------------------------------
describe('scoreRoutes — bestInsertion shape', () => {
  let ins;

  beforeAll(() => {
    const result = scoreRoutes(generalHappyPath.technicians, generalHappyPath.lead, 3);
    ins = result.topMatches[0].bestInsertion;
  });

  it('has timedRisk', () => {
    expect(['none', 'low', 'medium', 'high']).toContain(ins.timedRisk);
  });

  it('has backtrackingRisk', () => {
    expect(['None', 'Low', 'Moderate', 'High', 'Severe']).toContain(ins.backtrackingRisk);
  });

  it('has optimizationConfidence', () => {
    expect(['High', 'Medium', 'Low']).toContain(ins.optimizationConfidence);
  });

  it('has suggestedWindow', () => {
    expect(['AM', 'PM', null]).toContain(ins.suggestedWindow);
  });

  it('has estimatedArrivalTime (string or null)', () => {
    expect(ins).toHaveProperty('estimatedArrivalTime');
  });

  it('has insertAfterLabel (string or null)', () => {
    expect(ins).toHaveProperty('insertAfterLabel');
  });

  it('has insertBeforeLabel (string or null)', () => {
    expect(ins).toHaveProperty('insertBeforeLabel');
  });

  it('has insertionPositionLabel (string)', () => {
    expect(typeof ins.insertionPositionLabel).toBe('string');
  });

  it('has prevStop (object or null)', () => {
    expect(ins).toHaveProperty('prevStop');
    if (ins.prevStop !== null) {
      expect(ins.prevStop).toHaveProperty('customerName');
      expect(ins.prevStop).toHaveProperty('scheduledArrival');
    }
  });

  it('has nextStop (object or null)', () => {
    expect(ins).toHaveProperty('nextStop');
    if (ins.nextStop !== null) {
      expect(ins.nextStop).toHaveProperty('customerName');
      expect(ins.nextStop).toHaveProperty('scheduledArrival');
      expect(ins.nextStop).toHaveProperty('isTimed');
      expect(ins.nextStop).toHaveProperty('windowLabel');
    }
  });

  it('has addedDriveTime (string)', () => {
    expect(typeof ins.addedDriveTime).toBe('string');
  });

  it('has detourMiles (number)', () => {
    expect(typeof ins.detourMiles).toBe('number');
  });

  it('has serviceDuration (string)', () => {
    expect(typeof ins.serviceDuration).toBe('string');
  });

  it('has viable (boolean)', () => {
    expect(typeof ins.viable).toBe('boolean');
  });

  it('has backtrackingDetail (string or null)', () => {
    expect(ins).toHaveProperty('backtrackingDetail');
  });

  it('has timedSafetyLabel (string)', () => {
    expect(typeof ins.timedSafetyLabel).toBe('string');
  });

  it('has eodLabel (string or null)', () => {
    expect(ins).toHaveProperty('eodLabel');
  });

  it('has startEndLocationFit (string)', () => {
    expect(typeof ins.startEndLocationFit).toBe('string');
  });
});
