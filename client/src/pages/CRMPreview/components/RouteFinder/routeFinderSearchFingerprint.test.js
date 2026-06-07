import { describe, it, expect } from 'vitest';
import {
  buildRouteFinderSearchFingerprint,
  shouldSkipAutoRouteSearch,
} from './routeFinderSearchFingerprint.js';
import { SCORING_MODES } from '../../../../utils/routeFinderScoring.js';

const BASE = {
  geocode: { lat: 43.66, lng: -70.25 },
  timeWindowPreference: 'AM',
  serviceTypeId: 'it',
  commercialDurationMinutes: 60,
  scoringMode: SCORING_MODES.SINGLE_DATE,
  activeDate: '2026-06-09',
  dateStatus: { '2026-06-09': { status: 'cached' } },
  dateKeys: ['2026-06-09'],
};

describe('routeFinderSearchFingerprint', () => {
  it('builds stable fingerprint for same user inputs', () => {
    const a = buildRouteFinderSearchFingerprint(BASE);
    const b = buildRouteFinderSearchFingerprint(BASE);
    expect(a).toBe(b);
  });

  it('changes fingerprint when address or service changes', () => {
    const base = buildRouteFinderSearchFingerprint(BASE);
    const moved = buildRouteFinderSearchFingerprint({
      ...BASE,
      geocode: { lat: 44.01, lng: -70.25 },
    });
    const otherService = buildRouteFinderSearchFingerprint({
      ...BASE,
      serviceTypeId: 'iq',
    });
    expect(moved).not.toBe(base);
    expect(otherService).not.toBe(base);
  });

  it('skips auto search when fingerprint unchanged and results exist', () => {
    const fingerprint = buildRouteFinderSearchFingerprint(BASE);
    expect(shouldSkipAutoRouteSearch({
      fingerprint,
      lastFingerprint: fingerprint,
      scoringStatus: 'done',
      hasResults: true,
    })).toBe(true);
  });

  it('skips while scoring is in flight for the same inputs', () => {
    const fingerprint = buildRouteFinderSearchFingerprint(BASE);
    expect(shouldSkipAutoRouteSearch({
      fingerprint,
      lastFingerprint: fingerprint,
      scoringStatus: 'loading',
      hasResults: false,
    })).toBe(true);
  });

  it('does not skip when results are missing or inputs changed', () => {
    const fingerprint = buildRouteFinderSearchFingerprint(BASE);
    expect(shouldSkipAutoRouteSearch({
      fingerprint,
      lastFingerprint: fingerprint,
      scoringStatus: 'done',
      hasResults: false,
    })).toBe(false);

    expect(shouldSkipAutoRouteSearch({
      fingerprint,
      lastFingerprint: 'other',
      scoringStatus: 'done',
      hasResults: true,
    })).toBe(false);
  });
});
