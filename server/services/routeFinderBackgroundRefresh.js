import { preloadStaleWorkingDays, getStatus } from './fieldRoutesPreloader.js';
import { checkAuthHealth } from './fieldRoutesAuth.js';
import { isFieldRoutesScrapeInFlight } from './fieldRoutesScrapeLock.js';
import {
  hasFieldRoutesCredentials,
  refreshFieldRoutesSessionWithCredentials,
} from './fieldRoutesHeadlessLogin.js';

/** Max route scrapes per 5-minute background tick (priority dates first). */
const BACKGROUND_MAX_DATES_PER_TICK = 2;

/**
 * Quiet Route Finder upkeep: session check + stale route preload only.
 * Respects ROUTE_CACHE_TTL_MS (10 min) — scrapes capped per tick to limit FieldRoutes load.
 */
export async function runRouteFinderBackgroundRefresh({ priorityDates = [] } = {}) {
  if (isFieldRoutesScrapeInFlight()) {
    const status = await getStatus();
    console.log('[routes] Background refresh skipped — scrape already in flight');
    return {
      ok: status._auth?.status === 'ok',
      authResult: status._auth?.status,
      skipped: true,
      reason: 'scrape_in_flight',
      status,
      startedAt: new Date().toISOString(),
    };
  }

  const startedAt = new Date().toISOString();
  const priority = [...new Set((priorityDates || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
  console.log('[routes] Background refresh started', { priorityDates: priority });

  let authResult = await checkAuthHealth({ force: false });
  let authRefreshedWithCredentials = false;

  if (authResult !== 'ok' && hasFieldRoutesCredentials()) {
    console.log('[routes] Background refresh: attempting server credential login…');
    try {
      await refreshFieldRoutesSessionWithCredentials();
      authRefreshedWithCredentials = true;
      authResult = await checkAuthHealth({ force: true });
      console.log(`[routes] Background refresh: post-login auth=${authResult}`);
    } catch (err) {
      console.warn('[routes] Background refresh: credential login failed:', err.message);
    }
  }

  let preloadStarted = false;
  let refreshedDates = [];
  let remainingStale = 0;

  if (authResult === 'ok') {
    preloadStarted = true;
    try {
      const preloadResult = await preloadStaleWorkingDays({
        force: false,
        priorityDates: priority,
        maxPerTick: BACKGROUND_MAX_DATES_PER_TICK,
      });
      refreshedDates = preloadResult.refreshed;
      remainingStale = preloadResult.remainingStale;
      console.log(
        `[routes] Background stale preload: refreshed=${refreshedDates.join(',') || 'none'} remaining=${remainingStale}`,
      );
    } catch (err) {
      console.warn('[routes] Background stale preload failed:', err.message);
    }
  } else {
    console.warn(`[routes] Background refresh: skipping preload (auth=${authResult})`);
  }

  const status = await getStatus();
  console.log(
    `[routes] Background refresh finished auth=${status._auth?.status} preloadStarted=${preloadStarted}`,
  );

  return {
    ok: authResult === 'ok',
    authResult,
    authRefreshedWithCredentials,
    preloadStarted,
    refreshedDates,
    remainingStale,
    status,
    startedAt,
  };
}
