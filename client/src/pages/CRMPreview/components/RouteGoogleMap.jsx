import { useEffect, useRef, useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useGoogleMapsLoader } from './RouteFinder/useGoogleMapsLoader.js';
import { getStopMarkerMeta, getRoutePathCoords, getMapCoordinateStatus } from './RouteFinder/routeMapStops.js';
import { decodeRoadPath } from '../../../utils/decodePolyline.js';
import { describeMapLoadError } from './RouteFinder/mapLoadErrors.js';

const ROLE_COLORS = {
  start: '#DC2626',
  end: '#DC2626',
  home_start: '#7C3AED',
  home_end: '#7C3AED',
  middle: '#2563EB',
  new: '#16A34A',
};

function buildMarkerIcon(maps, role, label) {
  const color = ROLE_COLORS[role] || ROLE_COLORS.middle;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="12" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="14" y="18" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${label}</text>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(28, 28),
    anchor: new maps.Point(14, 14),
  };
}

function MapFallback({ wrapperClass, title, hint, code, detail }) {
  useEffect(() => {
    console.warn('[RouteFinder Maps]', code, detail || hint);
  }, [code, detail, hint]);

  return (
    <div className={wrapperClass}>
      <div className="route-google-map__fallback">
        <p className="m-0 type-body-sm font-semibold text-gs-danger">{title}</p>
        {hint && (
          <p className="m-0 mt-1 type-label-sm text-gs-muted">{hint}</p>
        )}
        {detail && code !== 'no_coordinates' && (
          <p className="m-0 mt-1 type-label-sm text-gs-muted route-google-map__error-detail">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

function refreshMapLayout(map, maps, path, padding) {
  if (!map || !maps || !path.length) return;
  maps.event.trigger(map, 'resize');
  const bounds = new maps.LatLngBounds();
  path.forEach(p => bounds.extend(p));
  map.fitBounds(bounds, padding);
}

export default function RouteGoogleMap({
  stops,
  mapType = 'satellite',
  interactive = true,
  compact = false,
  detailView = false,
  showControls = true,
  onExpand,
  className = '',
  roadPolyline = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef({ markers: [], polyline: null });
  const { status, errorCode, errorDetail, hasKey } = useGoogleMapsLoader();
  const [mapInitError, setMapInitError] = useState(null);
  const [localType, setLocalType] = useState(mapType);
  const coordStatus = useMemo(() => getMapCoordinateStatus(stops), [stops]);
  const markerMeta = useMemo(() => getStopMarkerMeta(stops), [stops]);
  const straightPath = useMemo(() => getRoutePathCoords(stops), [stops]);
  const roadPath = useMemo(
    () => decodeRoadPath(roadPolyline?.encodedPolyline),
    [roadPolyline?.encodedPolyline],
  );
  const usingRoadPath = roadPath.length >= 2 && !roadPolyline?.fallbackUsed;
  const path = usingRoadPath ? roadPath : straightPath;

  useEffect(() => {
    setLocalType(mapType);
  }, [mapType]);

  useEffect(() => {
    if (status !== 'ready' || !containerRef.current || !window.google?.maps) return;
    if (!path.length) return;

    setMapInitError(null);

    try {
      const maps = window.google.maps;
      const padding = compact ? 48 : 72;

      if (!mapRef.current) {
        mapRef.current = new maps.Map(containerRef.current, {
          mapTypeId: localType === 'satellite' ? 'satellite' : 'roadmap',
          disableDefaultUI: !showControls,
          zoomControl: showControls,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: interactive && !compact,
          gestureHandling: interactive ? 'greedy' : 'none',
          clickableIcons: false,
        });
      }

      mapRef.current.setMapTypeId(localType === 'satellite' ? 'satellite' : 'roadmap');

      overlaysRef.current.markers.forEach(m => m.setMap(null));
      overlaysRef.current.markers = [];

      if (overlaysRef.current.polyline) {
        overlaysRef.current.polyline.setMap(null);
        overlaysRef.current.polyline = null;
      }

      overlaysRef.current.polyline = new maps.Polyline({
        path,
        geodesic: !usingRoadPath,
        strokeColor: usingRoadPath ? '#16A34A' : '#F59E0B',
        strokeOpacity: usingRoadPath ? 0.95 : 0.85,
        strokeWeight: compact ? 3 : 5,
      });

      overlaysRef.current.polyline.setMap(mapRef.current);

      refreshMapLayout(mapRef.current, maps, path, padding);

      markerMeta.forEach(meta => {
        const marker = new maps.Marker({
          position: { lat: Number(meta.lat), lng: Number(meta.lng) },
          map: mapRef.current,
          icon: buildMarkerIcon(maps, meta.role, meta.label),
          title: meta.customerName,
          zIndex: meta.isNew ? 100 : meta.role === 'start' || meta.role === 'end' ? 90 : 10,
        });

        overlaysRef.current.markers.push(marker);
      });

      // Detail overlay animates in — resize after layout settles
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          refreshMapLayout(mapRef.current, maps, path, padding);
        });
      });
    } catch (err) {
      const detail = err?.message || String(err);
      console.error('[RouteFinder Maps] map_init_error', detail, err);
      setMapInitError({ code: 'map_init_error', detail });
    }
  }, [status, markerMeta, path, straightPath, usingRoadPath, localType, interactive, compact, showControls]);

  useEffect(() => {
    if (status !== 'ready' || !containerRef.current || !mapRef.current || !path.length) return;
    const maps = window.google?.maps;
    if (!maps) return;

    const padding = compact ? 48 : 72;
    const ro = new ResizeObserver(() => {
      refreshMapLayout(mapRef.current, maps, path, padding);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [status, path, compact]);

  const wrapperClass = [
    'route-google-map',
    detailView ? 'route-google-map--detail' : compact ? 'route-google-map--compact' : 'route-google-map--full',
    onExpand ? 'route-google-map--clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  if (!coordStatus.ok && coordStatus.code === 'no_coordinates') {
    const { title, hint } = describeMapLoadError('no_coordinates');

    return (
      <MapFallback
        wrapperClass={wrapperClass}
        title={title}
        hint={`${hint} (${coordStatus.withCoords}/${coordStatus.total} stops have coordinates.)`}
        code="no_coordinates"
      />
    );
  }

  if (!hasKey || status === 'no_key') {
    const { title, hint } = describeMapLoadError('no_key');

    return (
      <MapFallback
        wrapperClass={wrapperClass}
        title={title}
        hint={hint}
        code="no_key"
      />
    );
  }

  if (status === 'loading') {
    return (
      <div className={wrapperClass}>
        <div className="route-google-map__fallback">
          <span className="flex items-center gap-2 type-body-sm text-gs-muted">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            Loading map…
          </span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    const { title, hint } = describeMapLoadError(errorCode, errorDetail);

    return (
      <MapFallback
        wrapperClass={wrapperClass}
        title={title}
        hint={hint}
        code={errorCode}
        detail={errorDetail}
      />
    );
  }

  if (mapInitError) {
    const { title, hint } = describeMapLoadError(mapInitError.code, mapInitError.detail);

    return (
      <MapFallback
        wrapperClass={wrapperClass}
        title={title}
        hint={hint}
        code={mapInitError.code}
        detail={mapInitError.detail}
      />
    );
  }

  if (status === 'ready' && !path.length) {
    const { title, hint } = describeMapLoadError('no_coordinates');

    return (
      <MapFallback
        wrapperClass={wrapperClass}
        title={title}
        hint={hint}
        code="no_coordinates"
      />
    );
  }

  return (
    <div className={wrapperClass}>
      {showControls && (
        <div className="route-google-map__type-toggle" role="group" aria-label="Map type">
          <button
            type="button"
            className={localType === 'satellite' ? 'is-active' : ''}
            onClick={() => setLocalType('satellite')}
          >
            Satellite
          </button>
          <button
            type="button"
            className={localType === 'roadmap' ? 'is-active' : ''}
            onClick={() => setLocalType('roadmap')}
          >
            Map
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="route-google-map__canvas"
        role="img"
        aria-label="Route map"
      />

      {coordStatus.code === 'partial_coordinates' && (
        <p className="route-google-map__coord-note type-label-sm m-0">
          Showing {coordStatus.withCoords} of {coordStatus.total} stops on map
        </p>
      )}

      {!detailView && !usingRoadPath && path.length >= 2 && (
        <p className="route-google-map__coord-note type-label-sm m-0 text-amber-600">
          Estimated visual route — road path unavailable
        </p>
      )}

      {onExpand && (
        <button type="button" className="route-google-map__expand-hint" onClick={onExpand}>
          Click to open full route map
        </button>
      )}

      {compact && onExpand && (
        <button
          type="button"
          className="route-google-map__expand-overlay"
          aria-label="Open full route map"
          onClick={onExpand}
        />
      )}
    </div>
  );
}