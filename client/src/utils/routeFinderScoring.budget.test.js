import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreBestAvailable } from './routeFinderScoring.js';
import { generalHappyPath } from './__tests__/fieldRoutesScorer.fixtures.js';

const prefetchMock = vi.fn();

vi.mock('./routeTravelContext.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    prefetchTravelContext: (...args) => prefetchMock(...args),
  };
});

describe('scoreBestAvailable budget control', () => {
  beforeEach(() => {
    prefetchMock.mockReset();
    prefetchMock.mockResolvedValue({
      travelDiagnostics: {
        roadTimingUsed: true,
        elementsRequested: 20,
        elementsBudgetRemaining: 230,
      },
      getSegment: () => ({
        travelMinutes: 10,
        distanceMiles: 5,
        provider: 'google-routes',
        accuracy: 'road-based',
      }),
      getProviderName: () => 'google-routes',
    });
  });

  it('does not road-score every route on every day', async () => {
    const leadBase = { ...generalHappyPath.lead, date: null };
    const base = generalHappyPath.technicians[0];
    const technicians = Array.from({ length: 6 }, (_, i) => ({
      ...base,
      routeId: `R-BA-${i}`,
      techId: 200 + i,
      techName: `Tech ${i}`,
    }));

    const result = await scoreBestAvailable({
      leadBase,
      dateMetas: [
        { key: '2026-06-09', label: 'Mon' },
        { key: '2026-06-10', label: 'Tue' },
        { key: '2026-06-11', label: 'Wed' },
      ],
      dateStatus: {
        '2026-06-09': { status: 'cached' },
        '2026-06-10': { status: 'cached' },
        '2026-06-11': { status: 'cached' },
      },
      fetchPayload: async () => ({ technicians }),
      topN: 3,
      maxExtra: 10,
      prefetchTravel: true,
    });

    expect(result.topMatches.length).toBeGreaterThan(0);
    expect(prefetchMock.mock.calls.length).toBeLessThanOrEqual(5);
    expect(result.totalRoutesScored).toBeGreaterThan(5);

    const allReturned = [...result.topMatches, ...result.additionalMatches];
    const estimatedOnly = allReturned.filter(m => m.travelDiagnostics?.roadTimingUsed === false);
    expect(estimatedOnly.length).toBeGreaterThan(0);
  });
});
