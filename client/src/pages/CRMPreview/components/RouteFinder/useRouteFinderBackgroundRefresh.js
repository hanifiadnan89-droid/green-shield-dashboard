import { useEffect, useRef } from 'react';
import { api } from '../../../../api/client.js';

/** Client tick interval — server route cache TTL is 1h, so most ticks only check auth metadata. */
export const ROUTE_FINDER_BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

function routeFinderDebug(label, detail) {
  if (import.meta.env.DEV) {
    console.debug(`[RouteFinder] ${label}`, detail);
  }
}

/**
 * Keeps FieldRoutes session + route cache warm while Route Finder is open.
 * Does not clear address, time window, or match results.
 */
export function useRouteFinderBackgroundRefresh({
  applyStatusData,
  startPolling,
  reloadActiveDatePayload,
}) {
  const inFlightRef = useRef(false);
  const intervalRef = useRef(null);
  const applyStatusRef = useRef(applyStatusData);
  const startPollingRef = useRef(startPolling);
  const reloadPayloadRef = useRef(reloadActiveDatePayload);

  applyStatusRef.current = applyStatusData;
  startPollingRef.current = startPolling;
  reloadPayloadRef.current = reloadActiveDatePayload;

  useEffect(() => {
    const run = async () => {
      if (document.hidden || inFlightRef.current) return;
      inFlightRef.current = true;
      routeFinderDebug('background refresh started', { at: new Date().toISOString() });

      try {
        const result = await api.routes.backgroundRefresh();
        routeFinderDebug('background refresh response', {
          ok: result?.ok,
          auth: result?.status?._auth?.status,
          preloadStarted: result?.preloadStarted,
          authRefreshedWithCredentials: result?.authRefreshedWithCredentials,
        });

        if (result?.status) {
          applyStatusRef.current(result.status);
        }

        if (result?.preloadStarted) {
          const anyRefreshing = Object.entries(result.status || {}).some(
            ([key, entry]) => key !== '_auth' && entry?.status === 'refreshing',
          );
          if (anyRefreshing) {
            startPollingRef.current();
          }
        }

        await reloadPayloadRef.current?.(result?.status);
      } catch (err) {
        console.warn('[RouteFinder] background refresh failed:', err?.message || err);
        routeFinderDebug('background refresh failed', err?.message);
      } finally {
        inFlightRef.current = false;
      }
    };

    intervalRef.current = setInterval(run, ROUTE_FINDER_BACKGROUND_REFRESH_MS);

    const onVisibility = () => {
      if (!document.hidden) run();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
