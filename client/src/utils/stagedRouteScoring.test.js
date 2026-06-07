import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generalHappyPath } from './__tests__/fieldRoutesScorer.fixtures.js';

const prefetchMock = vi.fn();

vi.mock('./routeTravelContext.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    prefetchTravelContext: (...args) => prefetchMock(...args),
  };
});

describe('stagedRouteScoring', () => {
  beforeEach(() => {
    prefetchMock.mockReset();
    prefetchMock.mockResolvedValue({
      travelDiagnostics: {
        roadTimingUsed: true,
        elementsRequested: 12,
        elementsBudgetRemaining: 238,
      },
      getSegment: () => ({
        travelMinutes: 8,
        distanceMiles: 4,
        provider: 'google-routes',
        accuracy: 'road-based',
      }),
      getProviderName: () => 'google-routes',
    });
  });

  it('road-scores only prefilter top routes, not every technician', async () => {
    const { stagedScoreRoutes } = await import('./stagedRouteScoring.js');
    const base = generalHappyPath.technicians[0];
    const technicians = Array.from({ length: 8 }, (_, i) => ({
      ...base,
      routeId: `R-PREF-${i}`,
      techId: 100 + i,
      techName: `Tech ${i}`,
    }));
    const lead = generalHappyPath.lead;

    await stagedScoreRoutes(technicians, lead, 3, { prefetchTravel: true });

    expect(prefetchMock).toHaveBeenCalledTimes(1);
    const [prefetchTechs] = prefetchMock.mock.calls[0];
    expect(prefetchTechs.length).toBe(5);
    expect(prefetchTechs.length).toBeLessThan(technicians.length);
  });
});
