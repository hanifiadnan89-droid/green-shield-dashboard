import { describe, it, expect } from 'vitest';
import {
  scoreSingleDate,
  scoreBestAvailable,
  SCORING_MODES,
} from './routeFinderScoring.js';
import { generalHappyPath } from './__tests__/fieldRoutesScorer.fixtures.js';

describe('routeFinderScoring', () => {
  it('scoreSingleDate enriches matches with trust and cost fields', async () => {
    const result = await scoreSingleDate(generalHappyPath.technicians, generalHappyPath.lead, 3, {
      prefetchTravel: false,
    });
    expect(result.mode).toBe(SCORING_MODES.SINGLE_DATE);
    expect(result.topMatches[0].confidenceLabel).toBeTruthy();
    expect(result.topMatches[0].costImpact).toBeTruthy();
    expect(result.topMatches[0].matchId).toContain('::');
  });

  it('scoreBestAvailable ranks across dates and skips missing', async () => {
    const leadBase = { ...generalHappyPath.lead, date: null };
    const result = await scoreBestAvailable({
      leadBase,
      dateMetas: [
        { key: '2026-06-09', label: 'Mon' },
        { key: '2026-06-10', label: 'Tue' },
        { key: '2026-06-11', label: 'Wed' },
      ],
      dateStatus: {
        '2026-06-09': { status: 'cached' },
        '2026-06-10': { status: 'missing' },
        '2026-06-11': { status: 'cached' },
      },
      fetchPayload: async () => ({ technicians: generalHappyPath.technicians }),
      topN: 3,
      prefetchTravel: false,
    });

    expect(result.mode).toBe(SCORING_MODES.BEST_AVAILABLE);
    expect(result.datesScored).toBe(2);
    expect(result.skippedDates).toHaveLength(1);
    expect(result.topMatches.length).toBeGreaterThan(0);
    expect(result.topMatches[0].routeDate).toBeTruthy();
    expect(result.topMatches[0].rank).toBe(1);
    const scores = result.topMatches.map(m => m.scores.total);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });
});
