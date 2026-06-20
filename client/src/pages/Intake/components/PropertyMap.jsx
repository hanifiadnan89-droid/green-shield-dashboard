import { useEffect, useRef, useState } from 'react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import { formatAcreage, formatSquareFeet } from '../../../utils/intake/polygonArea.js';
import { computeAreaMetrics } from './propertyMapArea.js';
import { addMapsListener, runListenerCleanups } from './propertyMapListeners.js';
import {
  createVertexMarker,
  rectangleToPolygon,
} from './propertyMapDrawing.js';

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

const PREVIEW_LINE_STYLE = {
  strokeColor: '#86efac',
  strokeOpacity: 0.9,
  strokeWeight: 2,
  clickable: false,
  zIndex: 1,
};

const DRAFT_RECT_STYLE = {
  ...POLYGON_STYLE,
  fillOpacity: 0.12,
  strokeOpacity: 0.75,
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

function latLngToPoint(latLng) {
  if (!latLng) return null;
  return { lat: latLng.lat(), lng: latLng.lng() };
}

export default function PropertyMap({
  center,
  polygonPath = [],
  mapType = 'satellite',
  onPolygonChange,
  onAreaChange,
  onBoundaryStatusChange,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonRef = useRef(null);
  const draftPolylineRef = useRef(null);
  const previewLineRef = useRef(null);
  const draftRectangleRef = useRef(null);
  const draftVerticesRef = useRef([]);
  const draftMarkersRef = useRef([]);
  const rectangleStartRef = useRef(null);
  const interactionCleanupsRef = useRef([]);
  const polygonListenerCleanupsRef = useRef([]);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onAreaChangeRef = useRef(onAreaChange);
  const onBoundaryStatusChangeRef = useRef(onBoundaryStatusChange);
  const activeToolRef = useRef(null);

  const { status } = useIntakeGoogleMapsLoader();
  const [mapReady, setMapReady] = useState(false);
  const [mapInitError, setMapInitError] = useState(null);
  const [geometryWarning, setGeometryWarning] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [draftPointCount, setDraftPointCount] = useState(0);
  const [hasBoundary, setHasBoundary] = useState(polygonPath.length >= 3);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
    onAreaChangeRef.current = onAreaChange;
    onBoundaryStatusChangeRef.current = onBoundaryStatusChange;
  }, [onPolygonChange, onAreaChange, onBoundaryStatusChange]);

  useEffect(() => {
    stopAllInteractions();
    draftVerticesRef.current = [];
    rectangleStartRef.current = null;
    setDraftPointCount(0);
    setActiveTool(null);
  }, [center?.lat, center?.lng]);

  function stopAllInteractions() {
    runListenerCleanups(interactionCleanupsRef.current);
    interactionCleanupsRef.current = [];
    mapInstanceRef.current?.setOptions?.({ draggable: true });
  }

  function clearPolygonListeners() {
    runListenerCleanups(polygonListenerCleanupsRef.current);
    polygonListenerCleanupsRef.current = [];
  }

  function clearDraftMarkers() {
    draftMarkersRef.current.forEach((marker) => {
      try {
        marker?.setMap?.(null);
      } catch {
        /* ignore */
      }
    });
    draftMarkersRef.current = [];
  }

  function clearPreviewLine() {
    try {
      previewLineRef.current?.setMap?.(null);
    } catch {
      /* ignore */
    }
    previewLineRef.current = null;
  }

  function clearDraftPolyline() {
    try {
      draftPolylineRef.current?.setMap?.(null);
    } catch {
      /* ignore */
    }
    draftPolylineRef.current = null;
  }

  function clearDraftRectangle() {
    try {
      draftRectangleRef.current?.setMap?.(null);
    } catch {
      /* ignore */
    }
    draftRectangleRef.current = null;
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
      setHasBoundary(true);
    } else {
      onAreaChangeRef.current?.({
        treatmentAcreage: 0,
        treatmentSquareFeet: 0,
        rawAcreage: 0,
        rawSquareFeet: 0,
      });
      onBoundaryStatusChangeRef.current?.('none');
      setHasBoundary(false);
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
      draftPolylineRef.current = new maps.Polyline({ ...DRAFT_LINE_STYLE, map, path });
      return;
    }
    draftPolylineRef.current.setPath(path);
    draftPolylineRef.current.setMap(map);
  }

  function updatePreviewLine(cursorLatLng) {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    const verts = draftVerticesRef.current;
    if (!map || !maps?.Polyline || !cursorLatLng || verts.length === 0) {
      clearPreviewLine();
      return;
    }

    const last = verts[verts.length - 1];
    const path = [last, latLngToPoint(cursorLatLng)].filter(Boolean);
    if (!previewLineRef.current) {
      previewLineRef.current = new maps.Polyline({ ...PREVIEW_LINE_STYLE, map, path });
      return;
    }
    previewLineRef.current.setPath(path);
    previewLineRef.current.setMap(map);
  }

  function updateDraftRectangle(endPoint) {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    const start = rectangleStartRef.current;
    if (!map || !maps?.Polygon || !start || !endPoint) return;

    const path = rectangleToPolygon(start, endPoint);
    if (!draftRectangleRef.current) {
      draftRectangleRef.current = new maps.Polygon({ ...DRAFT_RECT_STYLE, map, paths: path });
      return;
    }
    draftRectangleRef.current.setPaths(path);
    draftRectangleRef.current.setMap(map);
  }

  function applyPolygonPath(pathPoints, { editable = true } = {}) {
    const map = mapInstanceRef.current;
    const polygon = polygonRef.current;
    if (!map || !polygon || !pathPoints?.length) return false;

    polygon.setPath(pathPoints.map((p) => ({ lat: p.lat, lng: p.lng })));
    polygon.setMap(map);
    polygon.setEditable(editable);
    attachPolygonPathListeners(polygon);
    syncPolygon(polygon);
    return true;
  }

  function resetDraftVisuals() {
    clearDraftPolyline();
    clearPreviewLine();
    clearDraftRectangle();
    clearDraftMarkers();
    draftVerticesRef.current = [];
    rectangleStartRef.current = null;
    setDraftPointCount(0);
  }

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !center) return undefined;

    const lat = Number(center.lat);
    const lng = Number(center.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    let cancelled = false;

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
          setHasBoundary(true);
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
      stopAllInteractions();
      clearPolygonListeners();
      resetDraftVisuals();

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
      setHasBoundary(true);
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

  function clearCompletedPolygon() {
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
    setHasBoundary(false);
  }

  function startPolygonMode() {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    stopAllInteractions();
    resetDraftVisuals();
    clearCompletedPolygon();
    map.setOptions({ draggable: false });
    setActiveTool('polygon');

    const clickCleanup = addMapsListener(map, 'click', (event) => {
      const point = latLngToPoint(event?.latLng);
      if (!point) return;
      const maps = window.google?.maps;
      draftVerticesRef.current = [...draftVerticesRef.current, point];
      setDraftPointCount(draftVerticesRef.current.length);
      const marker = maps ? createVertexMarker(maps, map, point) : null;
      if (marker) draftMarkersRef.current.push(marker);
      updateDraftPolyline();
    });
    if (clickCleanup) interactionCleanupsRef.current.push(clickCleanup);

    const moveCleanup = addMapsListener(map, 'mousemove', (event) => {
      if (activeToolRef.current !== 'polygon') return;
      updatePreviewLine(event?.latLng);
    });
    if (moveCleanup) interactionCleanupsRef.current.push(moveCleanup);
  }

  function startRectangleMode() {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    stopAllInteractions();
    resetDraftVisuals();
    clearCompletedPolygon();
    map.setOptions({ draggable: false });
    setActiveTool('rectangle');

    const downCleanup = addMapsListener(map, 'mousedown', (event) => {
      const point = latLngToPoint(event?.latLng);
      if (!point) return;
      rectangleStartRef.current = point;
      clearDraftRectangle();
    });
    if (downCleanup) interactionCleanupsRef.current.push(downCleanup);

    const moveCleanup = addMapsListener(map, 'mousemove', (event) => {
      if (!rectangleStartRef.current) return;
      const point = latLngToPoint(event?.latLng);
      if (point) updateDraftRectangle(point);
    });
    if (moveCleanup) interactionCleanupsRef.current.push(moveCleanup);

    const upCleanup = addMapsListener(map, 'mouseup', (event) => {
      if (!rectangleStartRef.current) return;
      const end = latLngToPoint(event?.latLng);
      if (!end) return;
      const path = rectangleToPolygon(rectangleStartRef.current, end);
      stopAllInteractions();
      resetDraftVisuals();
      if (path.length >= 3 && computeAreaMetrics(path).sqFt > 50) {
        applyPolygonPath(path, { editable: false });
      }
      setActiveTool(null);
    });
    if (upCleanup) interactionCleanupsRef.current.push(upCleanup);
  }

  function undoLastPoint() {
    if (draftVerticesRef.current.length === 0) return;
    draftVerticesRef.current = draftVerticesRef.current.slice(0, -1);
    const lastMarker = draftMarkersRef.current.pop();
    try {
      lastMarker?.setMap?.(null);
    } catch {
      /* ignore */
    }
    setDraftPointCount(draftVerticesRef.current.length);
    if (draftVerticesRef.current.length === 0) {
      clearDraftPolyline();
      clearPreviewLine();
      return;
    }
    updateDraftPolyline();
  }

  function finishPolygonDrawing() {
    if (draftVerticesRef.current.length < 3) return;
    stopAllInteractions();
    applyPolygonPath([...draftVerticesRef.current], { editable: false });
    resetDraftVisuals();
    setActiveTool(null);
  }

  function startEditMode() {
    stopAllInteractions();
    resetDraftVisuals();
    const polygon = polygonRef.current;
    if (!polygon || !hasBoundary) return;
    polygon.setEditable(true);
    attachPolygonPathListeners(polygon);
    setActiveTool('edit');
  }

  function clearDrawing() {
    stopAllInteractions();
    resetDraftVisuals();
    clearCompletedPolygon();
    setActiveTool(null);
  }

  function redraw() {
    clearDrawing();
    startPolygonMode();
  }

  if (status === 'no_key') {
    return <div className="intake-error">Google Maps API key is not configured.</div>;
  }

  const showMapShell = status !== 'loading' && status !== 'error';
  const polygonActive = activeTool === 'polygon';
  const rectangleActive = activeTool === 'rectangle';

  return (
    <div className="intake-property-map">
      <div className="intake-map-toolbar intake-map-toolbar--stacked">
        <div className="intake-map-toolbar__row">
          <button
            type="button"
            className={`intake-map-btn ${polygonActive ? 'intake-map-btn--active' : ''}`}
            onClick={startPolygonMode}
            disabled={!mapReady}
          >
            Draw Polygon
          </button>
          <button
            type="button"
            className={`intake-map-btn ${rectangleActive ? 'intake-map-btn--active' : ''}`}
            onClick={startRectangleMode}
            disabled={!mapReady}
          >
            Quick Rectangle
          </button>
          <button
            type="button"
            className="intake-map-btn"
            onClick={undoLastPoint}
            disabled={!mapReady || !polygonActive || draftPointCount === 0}
          >
            Undo Point
          </button>
          <button
            type="button"
            className="intake-map-btn intake-map-btn--primary"
            onClick={finishPolygonDrawing}
            disabled={!mapReady || !polygonActive || draftPointCount < 3}
          >
            Finish Drawing
          </button>
        </div>
        <div className="intake-map-toolbar__row">
          <button
            type="button"
            className={`intake-map-btn ${activeTool === 'edit' ? 'intake-map-btn--active' : ''}`}
            onClick={startEditMode}
            disabled={!mapReady || !hasBoundary}
          >
            Edit
          </button>
          <button
            type="button"
            className="intake-map-btn"
            onClick={clearDrawing}
            disabled={!mapReady}
          >
            Clear
          </button>
          <button
            type="button"
            className="intake-map-btn"
            onClick={redraw}
            disabled={!mapReady}
          >
            Redraw
          </button>
        </div>
      </div>

      <p className="intake-map-hint">
        Use Quick Rectangle for fast estimates or Polygon for irregular treatment areas.
      </p>
      <p className="intake-map-hint intake-map-hint--subtle">
        Treatment area is rep-estimated and can be adjusted before quote.
      </p>

      {polygonActive && (
        <p className="intake-map-hint intake-map-hint--active">
          Click to place vertices ({draftPointCount}). Hover shows the next segment. Finish when the shape is closed.
        </p>
      )}

      {rectangleActive && (
        <p className="intake-map-hint intake-map-hint--active">
          Click and drag on the map to draw a rectangle around the treatment area.
        </p>
      )}

      {geometryWarning && (
        <p className="intake-map-hint intake-map-hint--warn">{geometryWarning}</p>
      )}

      {mapInitError && (
        <p className="intake-map-hint intake-map-hint--warn">{mapInitError}</p>
      )}

      {hasBoundary && activeTool !== 'polygon' && activeTool !== 'rectangle' && (
        <div className="intake-map-boundary-status">
          <span className="intake-map-boundary-status__badge">Boundary Drawn</span>
          <span>Acreage and sq ft calculated below</span>
        </div>
      )}

      {status === 'loading' && (
        <div className="intake-map-shell flex items-center justify-center text-sm text-slate-500">Loading map…</div>
      )}

      {status === 'error' && (
        <div className="intake-error">Unable to load Google Maps.</div>
      )}

      {showMapShell && (
        <div ref={mapRef} className="intake-map-shell intake-map-shell--draw" />
      )}
    </div>
  );
}
