/**
 * SCORER_CONFIG unit tests — validates the config object that centralises
 * all weights, thresholds, and business rules for the scorer.
 */
import { describe, it, expect } from 'vitest';
import { SCORER_CONFIG } from '../fieldRoutesScorer.js';

describe('SCORER_CONFIG', () => {
  it('has engine property', () => {
    expect(['legacy', 'vrptw']).toContain(SCORER_CONFIG.engine);
  });

  it('weights sum to 1.0', () => {
    const { weights } = SCORER_CONFIG;
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(1.0);
  });

  it('has required top-level keys', () => {
    for (const key of ['weights', 'speed', 'workday', 'thresholds', 'durations', 'exclusions', 'nh', 'areaBonus', 'penalties', 'vrptw']) {
      expect(SCORER_CONFIG).toHaveProperty(key);
    }
  });

  it('workday.dayStartMin is 8 AM (480 min)', () => {
    expect(SCORER_CONFIG.workday.dayStartMin).toBe(480);
  });

  it('workday.dayEndMin is 6 PM (1080 min)', () => {
    expect(SCORER_CONFIG.workday.dayEndMin).toBe(1080);
  });

  it('nh.approvedTechNames contains Alex Gray', () => {
    expect(SCORER_CONFIG.nh.approvedTechNames).toContain('Alex Gray');
  });

  it('exclusions.techNamePatterns are regexes', () => {
    for (const p of SCORER_CONFIG.exclusions.techNamePatterns) {
      expect(p instanceof RegExp).toBe(true);
    }
    expect(SCORER_CONFIG.exclusions.techNamePatterns.some(p => p.test('Leo'))).toBe(true);
    expect(SCORER_CONFIG.exclusions.techNamePatterns.some(p => p.test('No Tech Assigned'))).toBe(true);
  });

  it('durations.defaultMin is a positive integer', () => {
    expect(typeof SCORER_CONFIG.durations.defaultMin).toBe('number');
    expect(SCORER_CONFIG.durations.defaultMin).toBeGreaterThan(0);
  });

  it('vrptw has required objective coefficients', () => {
    const { vrptw } = SCORER_CONFIG;
    for (const key of ['alphaDetour', 'betaSoftLate', 'betaSoftEarly', 'gammaTimedAnchor', 'deltaDirection', 'epsilonCluster', 'zetaOvershoot']) {
      expect(typeof vrptw[key]).toBe('number');
    }
  });
});
