import { preloadNextSixWorkingDays, getStatus } from './fieldRoutesPreloader.js';
import { checkAuthHealth } from './fieldRoutesAuth.js';
import {
  hasFieldRoutesCredentials,
  refreshFieldRoutesSessionWithCredentials,
} from './fieldRoutesHeadlessLogin.js';

/**
 * Quiet Route Finder upkeep: session check + stale route preload only.
 * Respects ROUTE_CACHE_TTL_MS (1h) — FieldRoutes scrapes run only when cache is stale.
 */
export async function runRouteFinderBackgroundRefresh() {
  const startedAt = new Date().toISOString();
  console.log('[routes] Background refresh started');

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
  if (authResult === 'ok') {
    preloadStarted = true;
    preloadNextSixWorkingDays({ force: false }).catch((err) => {
      console.warn('[routes] Background preload failed:', err.message);
    });
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
    status,
    startedAt,
  };
}
