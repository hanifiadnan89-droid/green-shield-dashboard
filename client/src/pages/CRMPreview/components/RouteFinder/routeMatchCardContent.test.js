import { describe, it, expect } from 'vitest';

const CARD_SCORE_KEYS = ['travelEfficiency', 'workload', 'geographic'];

describe('RouteMatchCardContent score chips', () => {
  it('result cards only show DRIVE, LOAD, GEO', () => {
    expect(CARD_SCORE_KEYS).toEqual(['travelEfficiency', 'workload', 'geographic']);
    expect(CARD_SCORE_KEYS).not.toContain('timeWindow');
    expect(CARD_SCORE_KEYS).not.toContain('serviceDuration');
  });
});
