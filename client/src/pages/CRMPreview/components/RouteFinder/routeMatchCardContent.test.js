import { describe, it, expect } from 'vitest';

const DETAIL_SCORE_KEYS = ['travelEfficiency', 'workload', 'geographic'];
const GRID_SCORE_KEYS = ['travelEfficiency', 'timeWindow', 'workload', 'serviceDuration', 'geographic'];

describe('RouteMatchCardContent score chips', () => {
  it('detail view only shows DRIVE, LOAD, GEO', () => {
    expect(DETAIL_SCORE_KEYS).toEqual(['travelEfficiency', 'workload', 'geographic']);
    expect(DETAIL_SCORE_KEYS).not.toContain('timeWindow');
    expect(DETAIL_SCORE_KEYS).not.toContain('serviceDuration');
  });

  it('grid view still includes WIN and SVC', () => {
    expect(GRID_SCORE_KEYS).toContain('timeWindow');
    expect(GRID_SCORE_KEYS).toContain('serviceDuration');
  });
});
