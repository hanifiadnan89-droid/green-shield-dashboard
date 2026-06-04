import { useEffect, useRef } from 'react';
import { api } from '../../../../api/client.js';

/** Client tick interval — server re-scrapes routes when cache is older than 10 minutes. */
export const ROUTE_FINDER_BACKGROUND_REFRESH_MS = 5 * 60 * 1000;
const VISIBILITY_DEBOUNCE_MS = 800;

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
  getPriorityDates,
}) {
  const inFlightRef = useRef(false);
  const intervalRef = useRef(null);
  const applyStatusRef = useRef(applyStatusData);
  const startPollingRef = useRef(startPolling);
  const reloadPayloadRef = useRef(reloadActiveDatePayload);
  const getPriorityDatesRef = useRef(getPriorityDates);

  applyStatusRef.current = applyStatusData;
  startPollingRef.current = startPolling;
  reloadPayloadRef.current = reloadActiveDatePayload;
  getPriorityDatesRef.current = getPriorityDates;

  useEffect(() => {
    const run = async () => {
      if (document.hidden || inFlightRef.current) return;
      inFlightRef.current = true;
      routeFinderDebug('background refresh started', { at: new Date().toISOString() });

      try {
        const priorityDates = getPriorityDatesRef.current?.() || [];
        const result = await api.routes.backgroundRefresh(priorityDates);
        routeFinderDebug('background refresh response', {
          ok: result?.ok,
          auth: result?.status?._auth?.status,
          preloadStarted: result?.preloadStarted,
          refreshedDates: result?.refreshedDates,
          remainingStale: result?.remainingStale,
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

    let visibilityTimer = null;
    const onVisibility = () => {
      if (document.hidden) return;
      if (visibilityTimer) clearTimeout(visibilityTimer);
      visibilityTimer = setTimeout(run, VISIBILITY_DEBOUNCE_MS);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (visibilityTimer) clearTimeout(visibilityTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
