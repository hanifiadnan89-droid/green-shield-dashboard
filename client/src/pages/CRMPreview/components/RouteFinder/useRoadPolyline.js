import { useEffect, useRef, useState } from 'react';
import { api } from '../../../../api/client.js';
import { getMapStops } from './routeMapStops.js';

/**
 * Fetch road-following encoded polyline for detail map (on demand).
 */
export function useRoadPolyline({ stops, routeId, routeDate, enabled = true }) {
  const [state, setState] = useState({
    loading: false,
    provider: null,
    encodedPolyline: null,
    fallbackUsed: true,
    fallbackReason: null,
    cacheHit: false,
    warnings: [],
    error: null,
  });
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const mapStops = getMapStops(stops);
    if (mapStops.length < 2) {
      setState({
        loading: false,
        provider: 'straight-line',
        encodedPolyline: null,
        fallbackUsed: true,
        fallbackReason: 'insufficient_stops',
        cacheHit: false,
        warnings: ['Not enough stops with coordinates for a road route.'],
        error: null,
      });
      return;
    }

    const requestId = ++requestRef.current;
    setState(prev => ({ ...prev, loading: true, error: null }));

    const payloadStops = mapStops.map((stop, index) => ({
      lat: stop.lat,
      lng: stop.lng,
      stopId: stop.id || `stop-${index}`,
      label: stop.customerName || stop.label || null,
    }));

    (async () => {
      try {
        const result = await api.routes.roadPolyline({
          stops: payloadStops,
          context: { routeId, date: routeDate },
        });
        if (requestId !== requestRef.current) return;
        setState({
          loading: false,
          provider: result.provider || 'straight-line',
          encodedPolyline: result.encodedPolyline || null,
          fallbackUsed: Boolean(result.fallbackUsed),
          fallbackReason: result.fallbackReason || null,
          cacheHit: Boolean(result.cacheHit),
          warnings: result.warnings || [],
          error: null,
        });
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setState({
          loading: false,
          provider: 'straight-line',
          encodedPolyline: null,
          fallbackUsed: true,
          fallbackReason: 'client_fetch_failed',
          cacheHit: false,
          warnings: ['Estimated visual route — road path unavailable.'],
          error: err?.message || 'Road polyline request failed',
        });
      }
    })();
  }, [stops, routeId, routeDate, enabled]);

  return state;
}
