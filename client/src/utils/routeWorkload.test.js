import { describe, it, expect } from 'vitest';
import {
  assessRouteWorkload,
  applyLighterRoutePreference,
  workloadLabelForStopCount,
} from './routeWorkload.js';

function makeTech(stopCount, serviceMinutesEach = 30) {
  const stops = Array.from({ length: stopCount }, (_, i) => ({
    lat: 43.3 + i * 0.01,
    lng: -70.5,
    serviceType: 'Regular Service',
    durationMinutes: serviceMinutesEach,
  }));
  return { techName: `Tech ${stopCount}`, routeId: String(stopCount), stops };
}

describe('routeWorkload', () => {
  it('labels stop counts correctly', () => {
    expect(workloadLabelForStopCount(7)).toBe('healthy');
    expect(workloadLabelForStopCount(11)).toBe('heavy');
    expect(workloadLabelForStopCount(12)).toBe('avoid-if-possible');
  });

  it('applies heavy route penalty metadata', () => {
    const heavy = assessRouteWorkload(makeTech(12));
    expect(heavy.isHeavy).toBe(true);
    expect(heavy.workloadPenalty).toBeGreaterThan(0);
    expect(heavy.routeOptimizationStatus).toBe('inferred-heavy');
  });

  it('prefers lighter route within score gap', () => {
    const heavy = {
      techName: 'Heavy Tech',
      scores: { total: 88 },
      workload: { stopCount: 12, isHeavy: true },
      bestInsertion: { viable: true },
    };
    const light = {
      techName: 'Light Tech',
      scores: { total: 80 },
      workload: { stopCount: 7, isHeavy: false },
      bestInsertion: { viable: true },
    };
    const ranked = applyLighterRoutePreference([heavy, light]);
    expect(ranked[0].techName).toBe('Light Tech');
    expect(ranked[0].dispatcherNote).toMatch(/lighter workload/i);
  });

  it('keeps heavy route when no viable lighter alternative exists', () => {
    const heavy = {
      techName: 'Heavy Tech',
      scores: { total: 88 },
      workload: { stopCount: 12, isHeavy: true },
      bestInsertion: { viable: true },
    };
    const light = {
      techName: 'Light Tech',
      scores: { total: 50 },
      workload: { stopCount: 7, isHeavy: false },
      bestInsertion: { viable: true },
    };
    const ranked = applyLighterRoutePreference([heavy, light]);
    expect(ranked[0].techName).toBe('Heavy Tech');
  });
});
