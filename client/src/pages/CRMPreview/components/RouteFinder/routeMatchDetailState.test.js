import { describe, it, expect } from 'vitest';
import { resolveRouteMatchDetailState } from './routeMatchDetailState.js';

const MATCH = {
  matchId: '2026-06-09::R1',
  routeId: 'R1',
  techName: 'Alex Gray',
};

describe('resolveRouteMatchDetailState', () => {
  it('shows active match in detail view', () => {
    const state = resolveRouteMatchDetailState({
      view: 'detail',
      activeMatchKey: '2026-06-09::R1',
      matches: [MATCH],
      pinnedMatch: MATCH,
    });
    expect(state.detailMatch).toBe(MATCH);
    expect(state.detailStale).toBe(false);
  });

  it('keeps pinned match visible when refresh removes it from results', () => {
    const state = resolveRouteMatchDetailState({
      view: 'detail',
      activeMatchKey: '2026-06-09::R1',
      matches: [],
      pinnedMatch: MATCH,
    });
    expect(state.detailMatch).toBe(MATCH);
    expect(state.detailStale).toBe(true);
  });

  it('clears detail when back on grid', () => {
    const state = resolveRouteMatchDetailState({
      view: 'grid',
      activeMatchKey: null,
      matches: [MATCH],
      pinnedMatch: null,
    });
    expect(state.detailMatch).toBeNull();
    expect(state.detailStale).toBe(false);
  });
});
