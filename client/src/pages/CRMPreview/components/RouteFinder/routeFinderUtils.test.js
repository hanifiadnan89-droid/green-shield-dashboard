import { describe, it, expect, vi, afterEach } from 'vitest';
import { getLocalDateStr, buildDateMetas } from './routeFinderDates.js';
import { getDatePillTitle } from './getDatePillTitle.js';
import { buildRouteDateHelperText } from './buildRouteDateHelperText.js';

describe('getLocalDateStr', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats today as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T12:00:00'));
    expect(getLocalDateStr(0)).toBe('2026-05-30');
    expect(getLocalDateStr(1)).toBe('2026-05-31');
  });
});

describe('buildDateMetas', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns six weekday entries and skips Sunday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-31T12:00:00')); // Sunday — first pill is Monday
    const metas = buildDateMetas();
    expect(metas).toHaveLength(6);
    expect(metas[0].label).toBe('Tomorrow');
    metas.forEach((m) => {
      expect(m.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.label).toBeTruthy();
    });
    const keys = metas.map((m) => m.key);
    expect(new Set(keys).size).toBe(6);
  });

  it('labels Today and Tomorrow on a weekday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T12:00:00')); // Thursday
    const metas = buildDateMetas();
    expect(metas[0].label).toBe('Today');
    expect(metas[1].label).toBe('Tomorrow');
  });
});

describe('getDatePillTitle', () => {
  it('returns cached load hint', () => {
    expect(getDatePillTitle('cached', {}, 'Today')).toBe('Load routes for Today');
  });

  it('surfaces failed meta error', () => {
    expect(getDatePillTitle('failed', { error: 'Timeout' }, 'Mon')).toBe('Timeout');
  });

  it('falls back for failed without error', () => {
    expect(getDatePillTitle('failed', {}, 'Mon')).toBe('Load failed — use ↻ to retry');
  });
});

describe('buildRouteDateHelperText', () => {
  it('prioritizes login message', () => {
    expect(
      buildRouteDateHelperText({
        authNeedsLogin: true,
        anyDateRefreshing: true,
        refreshAllPending: true,
        hasCachedDate: false,
      }),
    ).toBe('Log in to FieldRoutes to load schedules. Use the banner above.');
  });

  it('shows refresh-all copy when pending', () => {
    expect(
      buildRouteDateHelperText({
        authNeedsLogin: false,
        anyDateRefreshing: true,
        refreshAllPending: true,
        hasCachedDate: true,
      }),
    ).toBe('Re-scraping all route dates from FieldRoutes…');
  });

  it('shows syncing copy when refreshing but not refresh-all', () => {
    expect(
      buildRouteDateHelperText({
        authNeedsLogin: false,
        anyDateRefreshing: true,
        refreshAllPending: false,
        hasCachedDate: true,
      }),
    ).toBe('Syncing schedules from FieldRoutes…');
  });

  it('shows cache hint when no cached dates', () => {
    expect(
      buildRouteDateHelperText({
        authNeedsLogin: false,
        anyDateRefreshing: false,
        refreshAllPending: false,
        hasCachedDate: false,
      }),
    ).toBe('Dates appear when cache is ready — use ↻ on a date or Refresh all in the header.');
  });

  it('returns null when cache is ready and idle', () => {
    expect(
      buildRouteDateHelperText({
        authNeedsLogin: false,
        anyDateRefreshing: false,
        refreshAllPending: false,
        hasCachedDate: true,
      }),
    ).toBeNull();
  });
});
