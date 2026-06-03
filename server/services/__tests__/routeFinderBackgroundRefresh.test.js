import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkAuthHealth = vi.fn();
const preloadStaleWorkingDays = vi.fn();
const getStatus = vi.fn();
const hasFieldRoutesCredentials = vi.fn();
const refreshFieldRoutesSessionWithCredentials = vi.fn();

vi.mock('../fieldRoutesPreloader.js', () => ({
  preloadStaleWorkingDays,
  getStatus,
}));

vi.mock('../fieldRoutesAuth.js', () => ({
  checkAuthHealth,
}));

vi.mock('../fieldRoutesHeadlessLogin.js', () => ({
  hasFieldRoutesCredentials,
  refreshFieldRoutesSessionWithCredentials,
}));

describe('runRouteFinderBackgroundRefresh', () => {
  let runRouteFinderBackgroundRefresh;

  beforeEach(async () => {
    vi.resetAllMocks();
    checkAuthHealth.mockResolvedValue('ok');
    hasFieldRoutesCredentials.mockReturnValue(false);
    preloadStaleWorkingDays.mockResolvedValue({ refreshed: ['2026-06-03'], remainingStale: 1 });
    getStatus.mockResolvedValue({
      '2026-06-03': { status: 'cached' },
      _auth: { status: 'ok', lastCheck: new Date().toISOString() },
    });
    const mod = await import('../routeFinderBackgroundRefresh.js');
    runRouteFinderBackgroundRefresh = mod.runRouteFinderBackgroundRefresh;
  });

  it('runs stale preload when auth is ok', async () => {
    const result = await runRouteFinderBackgroundRefresh();
    expect(result.ok).toBe(true);
    expect(result.preloadStarted).toBe(true);
    expect(preloadStaleWorkingDays).toHaveBeenCalledWith({
      force: false,
      priorityDates: [],
      maxPerTick: 2,
    });
    expect(result.refreshedDates).toEqual(['2026-06-03']);
    expect(result.remainingStale).toBe(1);
  });

  it('passes priority dates to stale preload', async () => {
    await runRouteFinderBackgroundRefresh({ priorityDates: ['2026-06-04', 'bad', '2026-06-04'] });
    expect(preloadStaleWorkingDays).toHaveBeenCalledWith({
      force: false,
      priorityDates: ['2026-06-04'],
      maxPerTick: 2,
    });
  });

  it('attempts credential refresh when auth is not ok', async () => {
    checkAuthHealth
      .mockResolvedValueOnce('needs_login')
      .mockResolvedValueOnce('ok');
    hasFieldRoutesCredentials.mockReturnValue(true);
    refreshFieldRoutesSessionWithCredentials.mockResolvedValue(undefined);

    const result = await runRouteFinderBackgroundRefresh();
    expect(refreshFieldRoutesSessionWithCredentials).toHaveBeenCalled();
    expect(result.authRefreshedWithCredentials).toBe(true);
    expect(result.preloadStarted).toBe(true);
  });

  it('skips preload when auth remains needs_login', async () => {
    checkAuthHealth.mockResolvedValue('needs_login');
    hasFieldRoutesCredentials.mockReturnValue(false);
    getStatus.mockResolvedValue({
      _auth: { status: 'needs_login', message: 'expired' },
    });

    const result = await runRouteFinderBackgroundRefresh();
    expect(result.ok).toBe(false);
    expect(result.preloadStarted).toBe(false);
    expect(preloadStaleWorkingDays).not.toHaveBeenCalled();
  });
});
