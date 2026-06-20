import { useEffect, useRef, useState } from 'react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import { formatAcreage, formatSquareFeet } from '../../../utils/intake/polygonArea.js';
import { boundsToPolygon } from '../../../utils/intake/propertyBoundary.js';
import { computeAreaMetrics } from './propertyMapArea.js';
import { addMapsListener, runListenerCleanups } from './propertyMapListeners.js';

const POLYGON_STYLE = {
  strokeColor: '#22c55e',
  strokeOpacity: 0.9,
  strokeWeight: 2,
  fillColor: '#22c55e',
  fillOpacity: 0.25,
};

const DRAFT_LINE_STYLE = {
  strokeColor: '#22c55e',
  strokeOpacity: 0.85,
  strokeWeight: 2,
  clickable: false,
};

function pathToArray(polygon) {
  const path = polygon?.getPath?.();
  if (!path || typeof path.getLength !== 'function') return [];
  const out = [];
  for (let i = 0; i < path.getLength(); i += 1) {
    const pt = path.getAt(i);
    if (!pt) continue;
    out.push({ lat: pt.lat(), lng: pt.lng() });
  }
  return out;
}

function geocodeViewport(lat, lng) {
  return new Promise((resolve) => {
    const Geocoder = window.google?.maps?.Geocoder;
    if (!Geocoder) {
      resolve(null);
      return;
    }
    const client = new Geocoder();
    client.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results?.[0]?.geometry?.viewport) {
        resolve(null);
        return;
      }
      resolve(boundsToPolygon(results[0].geometry.viewport));
    });
  });
}

export default function PropertyMap({
  center,
  polygonPath = [],
  suggestedBoundary = [],
  mapType = 'satellite',
  onPolygonChange,
  onAreaChange,
  onBoundaryStatusChange,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonRef = useRef(null);
  const draftPolylineRef = useRef(null);
  const draftVerticesRef = useRef([]);
  const mapClickCleanupRef = useRef(null);
  const polygonListenerCleanupsRef = useRef([]);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onAreaChangeRef = useRef(onAreaChange);
  const onBoundaryStatusChangeRef = useRef(onBoundaryStatusChange);
  const autoAppliedRef = useRef(false);

  const { status } = useIntakeGoogleMapsLoader();
  const [mapReady, setMapReady] = useState(false);
  const [mapInitError, setMapInitError] = useState(null);
  const [geometryWarning, setGeometryWarning] = useState(null);
  const [autoDetectMessage, setAutoDetectMessage] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [draftPointCount, setDraftPointCount] = useState(0);

  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
    onAreaChangeRef.current = onAreaChange;
    onBoundaryStatusChangeRef.current = onBoundaryStatusChange;
  }, [onPolygonChange, onAreaChange, onBoundaryStatusChange]);

  useEffect(() => {
    autoAppliedRef.current = false;
    setAutoDetectMessage(null);
    mapClickCleanupRef.current?.();
    mapClickCleanupRef.current = null;
    draftVerticesRef.current = [];
    setDraftPointCount(0);
  }, [center?.lat, center?.lng]);

  function stopMapClickDrawing() {
    mapClickCleanupRef.current?.();
    mapClickCleanupRef.current = null;
  }

  function clearPolygonListeners() {
    runListenerCleanups(polygonListenerCleanupsRef.current);
    polygonListenerCleanupsRef.current = [];
  }

  function emitArea(path) {
    const { acres, sqFt } = computeAreaMetrics(path);
    onAreaChangeRef.current?.({
      treatmentAcreage: Number(formatAcreage(acres)),
      treatmentSquareFeet: Number(String(formatSquareFeet(sqFt)).replace(/,/g, '')),
      rawAcreage: acres,
      rawSquareFeet: sqFt,
    });
  }

  function syncPolygon(polygon) {
    if (!polygon) return;
    const arr = pathToArray(polygon);
    onPolygonChangeRef.current?.(arr);
    if (arr.length >= 3) {
      emitArea(arr);
      onBoundaryStatusChangeRef.current?.('drawn');
    } else {
      onAreaChangeRef.current?.({
        treatmentAcreage: 0,
        treatmentSquareFeet: 0,
        rawAcreage: 0,
        rawSquareFeet: 0,
      });
      onBoundaryStatusChangeRef.current?.('none');
    }
  }

  function attachPolygonPathListeners(polygon) {
    clearPolygonListeners();
    const path = polygon?.getPath?.();
    if (!path) return;

    for (const eventName of ['set_at', 'insert_at', 'remove_at']) {
      const cleanup = addMapsListener(path, eventName, () => syncPolygon(polygon));
      if (cleanup) polygonListenerCleanupsRef.current.push(cleanup);
    }
  }

  function updateDraftPolyline() {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !maps?.Polyline) return;

    const path = draftVerticesRef.current.map((p) => ({ lat: p.lat, lng: p.lng }));
    if (!draftPolylineRef.current) {
      draftPolylineRef.current = new maps.Polyline({
        ...DRAFT_LINE_STYLE,
        map,
        path,
      });
      return;
    }

    draftPolylineRef.current.setPath(path);
    draftPolylineRef.current.setMap(map);
  }

  function clearDraftPolyline() {
    try {
      draftPolylineRef.current?.setMap?.(null);
    } catch {
      /* ignore */
    }
    draftPolylineRef.current = null;
  }

  function applyPolygonPath(pathPoints, { editable = true, detected = false } = {}) {
    const map = mapInstanceRef.current;
    const polygon = polygonRef.current;
    if (!map || !polygon || !pathPoints?.length) return false;

    polygon.setPath(pathPoints.map((p) => ({ lat: p.lat, lng: p.lng })));
    polygon.setMap(map);
    polygon.setEditable(editable);
    attachPolygonPathListeners(polygon);
    syncPolygon(polygon);
    if (detected) onBoundaryStatusChangeRef.current?.('detected');
    return true;
  }

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !center) return undefined;

    const lat = Number(center.lat);
    const lng = Number(center.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    let cancelled = false;

    const tryAutoBoundary = async () => {
      if (autoAppliedRef.current || polygonPath.length >= 3) return;

      let candidate = suggestedBoundary?.length >= 3 ? suggestedBoundary : null;
      let method = 'viewport';

      if (!candidate) {
        candidate = await geocodeViewport(lat, lng);
        method = candidate ? 'geocode' : null;
      }

      if (!candidate || cancelled) {
        if (!cancelled) {
          setAutoDetectMessage('Automatic property detection unavailable. Please draw treatment area manually.');
          onBoundaryStatusChangeRef.current?.('manual');
        }
        return;
      }

      autoAppliedRef.current = true;
      applyPolygonPath(candidate, { editable: true, detected: true });
      setAutoDetectMessage(
        method === 'viewport'
          ? 'Property boundary detected from address footprint. Adjust or redraw as needed.'
          : 'Estimated property boundary applied. Adjust or redraw as needed.',
      );
    };

    (async () => {
      setMapInitError(null);
      setGeometryWarning(null);
      setMapReady(false);

      const maps = window.google?.maps;
      if (!maps?.Map) {
        if (!cancelled) setMapInitError('Google Maps is not available');
        return;
      }

      try {
        if (!mapRef.current) return;

        const map = new maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom: 19,
          mapTypeId: mapType === 'roadmap' ? 'roadmap' : 'hybrid',
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        mapInstanceRef.current = map;
        setMapReady(true);

        try {
          await window.google.maps.importLibrary('geometry');
          if (!window.google?.maps?.geometry?.spherical?.computeArea) {
            setGeometryWarning('Geometry library unavailable — acreage uses built-in estimate.');
          }
        } catch {
          setGeometryWarning('Geometry library unavailable — acreage uses built-in estimate.');
        }

        const polygon = new maps.Polygon({
          ...POLYGON_STYLE,
          paths: polygonPath.length >= 3
            ? polygonPath.map((p) => ({ lat: p.lat, lng: p.lng }))
            : [],
          editable: false,
          draggable: false,
          map: polygonPath.length >= 3 ? map : null,
        });

        polygonRef.current = polygon;

        if (polygonPath.length >= 3) {
          attachPolygonPathListeners(polygon);
          emitArea(polygonPath);
          onBoundaryStatusChangeRef.current?.('drawn');
        }

        if (!cancelled && polygonPath.length < 3) {
          await tryAutoBoundary();
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Intake PropertyMap] init failed:', err);
          setMapInitError(err.message || 'Unable to initialize property map');
        }
      }
    })();

    return () => {
      cancelled = true;
      stopMapClickDrawing();
      clearPolygonListeners();
      clearDraftPolyline();

      try {
        polygonRef.current?.setMap?.(null);
      } catch {
        /* ignore */
      }

      mapInstanceRef.current = null;
      polygonRef.current = null;
      setMapReady(false);
    };
  }, [status, center?.lat, center?.lng]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const polygon = polygonRef.current;
    if (!map || !polygon || !mapReady) return;

    if (polygonPath.length >= 3) {
      polygon.setPath(polygonPath.map((p) => ({ lat: p.lat, lng: p.lng })));
      polygon.setMap(map);
      polygon.setEditable(activeTool === 'edit');
      attachPolygonPathListeners(polygon);
    }
  }, [polygonPath, mapReady, activeTool]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map?.setMapTypeId) return;
    try {
      map.setMapTypeId(mapType === 'roadmap' ? 'roadmap' : 'hybrid');
    } catch {
      /* map may be tearing down */
    }
  }, [mapType]);

  function startDrawing() {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    stopMapClickDrawing();
    clearDraftPolyline();
    draftVerticesRef.current = [];
    setDraftPointCount(0);

    const polygon = polygonRef.current;
    if (polygon) {
      polygon.setPath([]);
      polygon.setMap(null);
      polygon.setEditable(false);
      clearPolygonListeners();
    }

    onPolygonChangeRef.current?.([]);
    onAreaChangeRef.current?.({
      treatmentAcreage: 0,
      treatmentSquareFeet: 0,
      rawAcreage: 0,
      rawSquareFeet: 0,
    });
    onBoundaryStatusChangeRef.current?.('manual');
    setAutoDetectMessage(null);
    setActiveTool('draw');

    mapClickCleanupRef.current = addMapsListener(map, 'click', (event) => {
      const latLng = event?.latLng;
      if (!latLng) return;
      draftVerticesRef.current = [
        ...draftVerticesRef.current,
        { lat: latLng.lat(), lng: latLng.lng() },
      ];
      setDraftPointCount(draftVerticesRef.current.length);
      updateDraftPolyline();
    });
  }

  function finishDrawing() {
    if (draftVerticesRef.current.length < 3) return;

    stopMapClickDrawing();
    clearDraftPolyline();
    applyPolygonPath([...draftVerticesRef.current], { editable: false });
    draftVerticesRef.current = [];
    setDraftPointCount(0);
    setActiveTool(null);
    setAutoDetectMessage(null);
  }

  function setEditMode() {
    stopMapClickDrawing();
    clearDraftPolyline();
    draftVerticesRef.current = [];
    setDraftPointCount(0);

    const polygon = polygonRef.current;
    if (!polygon) return;
    polygon.setEditable(true);
    attachPolygonPathListeners(polygon);
    setActiveTool('edit');
  }

  function clearPolygon() {
    stopMapClickDrawing();
    clearDraftPolyline();
    draftVerticesRef.current = [];
    setDraftPointCount(0);

    const polygon = polygonRef.current;
    if (polygon) {
      polygon.setPath([]);
      polygon.setMap(null);
      polygon.setEditable(false);
      clearPolygonListeners();
    }

    setActiveTool(null);
    setAutoDetectMessage('Click Draw Polygon, then click the map to place treatment area vertices.');
    onPolygonChangeRef.current?.([]);
    onAreaChangeRef.current?.({
      treatmentAcreage: 0,
      treatmentSquareFeet: 0,
      rawAcreage: 0,
      rawSquareFeet: 0,
    });
    onBoundaryStatusChangeRef.current?.('manual');
  }

  if (status === 'no_key') {
    return <div className="intake-error">Google Maps API key is not configured.</div>;
  }

  const showMapShell = status !== 'loading' && status !== 'error';

  return (
    <div>
      <div className="intake-map-toolbar">
        <button
          type="button"
          className={`intake-map-btn ${activeTool === 'draw' ? 'intake-map-btn--active' : ''}`}
          onClick={startDrawing}
          disabled={!mapReady}
        >
          Draw Polygon
        </button>
        <button
          type="button"
          className="intake-map-btn intake-map-btn--primary"
          onClick={finishDrawing}
          disabled={!mapReady || activeTool !== 'draw' || draftPointCount < 3}
        >
          Finish Drawing
        </button>
        <button
          type="button"
          className={`intake-map-btn ${activeTool === 'edit' ? 'intake-map-btn--active' : ''}`}
          onClick={setEditMode}
          disabled={!mapReady}
        >
          Edit Polygon
        </button>
        <button
          type="button"
          className="intake-map-btn"
          onClick={clearPolygon}
          disabled={!mapReady}
        >
          Clear / Redraw
        </button>
      </div>

      {activeTool === 'draw' && (
        <p className="intake-map-hint">
          Click the map to add vertices ({draftPointCount} placed). Select Finish Drawing when done.
        </p>
      )}

      {geometryWarning && (
        <p className="intake-map-hint intake-map-hint--warn">{geometryWarning}</p>
      )}

      {autoDetectMessage && (
        <p className="intake-map-hint">{autoDetectMessage}</p>
      )}

      {mapInitError && (
        <p className="intake-map-hint intake-map-hint--warn">{mapInitError}</p>
      )}

      {status === 'loading' && (
        <div className="intake-map-shell flex items-center justify-center text-sm text-slate-500">Loading map…</div>
      )}

      {status === 'error' && (
        <div className="intake-error">Unable to load Google Maps.</div>
      )}

      {showMapShell && (
        <div ref={mapRef} className="intake-map-shell" />
      )}
    </div>
  );
}
