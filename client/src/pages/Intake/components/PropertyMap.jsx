import { useEffect, useRef, useState } from 'react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import {
  computePolygonAreaAcres,
  computePolygonAreaSqFt,
  formatAcreage,
  formatSquareFeet,
} from '../../../utils/intake/polygonArea.js';
import { boundsToPolygon } from '../../../utils/intake/propertyBoundary.js';
import { addMapsListener, runListenerCleanups } from './propertyMapListeners.js';

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
    const geocoder = window.google?.maps?.Geocoder;
    if (!geocoder) {
      resolve(null);
      return;
    }
    const client = new geocoder();
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
  const drawingManagerRef = useRef(null);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onAreaChangeRef = useRef(onAreaChange);
  const onBoundaryStatusChangeRef = useRef(onBoundaryStatusChange);
  const autoAppliedRef = useRef(false);
  const { status } = useIntakeGoogleMapsLoader();
  const [activeTool, setActiveTool] = useState(null);
  const [mapInitError, setMapInitError] = useState(null);
  const [drawingReady, setDrawingReady] = useState(false);
  const [autoDetectMessage, setAutoDetectMessage] = useState(null);

  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
    onAreaChangeRef.current = onAreaChange;
    onBoundaryStatusChangeRef.current = onBoundaryStatusChange;
  }, [onPolygonChange, onAreaChange, onBoundaryStatusChange]);

  useEffect(() => {
    autoAppliedRef.current = false;
    setAutoDetectMessage(null);
  }, [center?.lat, center?.lng]);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !center) return undefined;

    const lat = Number(center.lat);
    const lng = Number(center.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    let cancelled = false;
    const listenerCleanups = [];

    const emitArea = (path) => {
      const acres = computePolygonAreaAcres(path);
      const sqFt = computePolygonAreaSqFt(path);
      onAreaChangeRef.current?.({
        treatmentAcreage: Number(formatAcreage(acres)),
        treatmentSquareFeet: Number(String(formatSquareFeet(sqFt)).replace(/,/g, '')),
        rawAcreage: acres,
        rawSquareFeet: sqFt,
      });
    };

    const syncPolygon = (polygon) => {
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
    };

    const attachPolygonPathListeners = (polygon) => {
      const path = polygon?.getPath?.();
      if (!path) return;

      for (const eventName of ['set_at', 'insert_at', 'remove_at']) {
        const cleanup = addMapsListener(path, eventName, () => syncPolygon(polygon));
        if (cleanup) listenerCleanups.push(cleanup);
      }
    };

    const applyPolygonPath = (polygon, map, pathPoints, { editable = true, detected = false } = {}) => {
      if (!polygon || !map || !pathPoints?.length) return false;
      polygon.setPath(pathPoints.map((p) => ({ lat: p.lat, lng: p.lng })));
      polygon.setMap(map);
      polygon.setEditable(editable);
      attachPolygonPathListeners(polygon);
      syncPolygon(polygon);
      if (detected) onBoundaryStatusChangeRef.current?.('detected');
      return true;
    };

    const tryAutoBoundary = async (polygon, map) => {
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
      applyPolygonPath(polygon, map, candidate, { editable: true, detected: true });
      setAutoDetectMessage(
        method === 'viewport'
          ? 'Property boundary detected from address footprint. Adjust or redraw as needed.'
          : 'Estimated property boundary applied. Adjust or redraw as needed.',
      );
    };

    (async () => {
      try {
        setMapInitError(null);
        setDrawingReady(false);
        const maps = window.google?.maps;
        if (!maps?.Map) throw new Error('Google Maps is not available');

        await window.google.maps.importLibrary('drawing');

        if (cancelled || !mapRef.current) return;

        const DrawingManager = window.google?.maps?.drawing?.DrawingManager;
        if (!DrawingManager) throw new Error('Google Maps Drawing library is not available');

        const map = new maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom: 19,
          mapTypeId: mapType === 'roadmap' ? 'roadmap' : 'hybrid',
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        mapInstanceRef.current = map;

        const polygon = new maps.Polygon({
          paths: polygonPath.length >= 3
            ? polygonPath.map((p) => ({ lat: p.lat, lng: p.lng }))
            : [],
          strokeColor: '#22c55e',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.25,
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

        const drawingManager = new DrawingManager({
          drawingMode: null,
          drawingControl: false,
          polygonOptions: {
            strokeColor: '#22c55e',
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: '#22c55e',
            fillOpacity: 0.25,
            editable: true,
          },
        });

        drawingManager.setMap(map);
        drawingManagerRef.current = drawingManager;
        setDrawingReady(true);

        const overlayCleanup = addMapsListener(drawingManager, 'overlaycomplete', (event) => {
          if (event.type !== 'polygon' || !polygonRef.current || !mapInstanceRef.current) return;

          const activePolygon = polygonRef.current;
          const activeMap = mapInstanceRef.current;
          const activeDrawingManager = drawingManagerRef.current;
          if (!activeDrawingManager) return;

          event.overlay?.setMap?.(null);

          const newPath = event.overlay?.getPath?.();
          if (!newPath) return;

          activePolygon.setPath(newPath);
          activePolygon.setMap(activeMap);
          activePolygon.setEditable(true);
          attachPolygonPathListeners(activePolygon);
          activeDrawingManager.setDrawingMode(null);
          setActiveTool(null);
          setAutoDetectMessage(null);
          syncPolygon(activePolygon);
        });

        if (overlayCleanup) listenerCleanups.push(overlayCleanup);

        if (polygonPath.length < 3) {
          await tryAutoBoundary(polygon, map);
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
      runListenerCleanups(listenerCleanups);

      try {
        polygonRef.current?.setMap?.(null);
        drawingManagerRef.current?.setMap?.(null);
      } catch {
        /* ignore */
      }

      mapInstanceRef.current = null;
      polygonRef.current = null;
      drawingManagerRef.current = null;
      setDrawingReady(false);
    };
  }, [status, center?.lat, center?.lng]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const polygon = polygonRef.current;
    if (!map || !polygon) return;

    if (polygonPath.length >= 3) {
      polygon.setPath(polygonPath.map((p) => ({ lat: p.lat, lng: p.lng })));
      polygon.setMap(map);
      polygon.setEditable(true);
    }
  }, [polygonPath]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map?.setMapTypeId) return;
    try {
      map.setMapTypeId(mapType === 'roadmap' ? 'roadmap' : 'hybrid');
    } catch {
      /* map may be tearing down */
    }
  }, [mapType]);

  function setDrawMode() {
    const dm = drawingManagerRef.current;
    const overlayType = window.google?.maps?.drawing?.OverlayType?.POLYGON;
    if (!dm || !overlayType) return;
    dm.setDrawingMode(overlayType);
    setActiveTool('draw');
  }

  function setEditMode() {
    const polygon = polygonRef.current;
    const dm = drawingManagerRef.current;
    if (!polygon || !dm) return;
    dm.setDrawingMode(null);
    polygon.setEditable(true);
    setActiveTool('edit');
  }

  function deletePolygon() {
    const polygon = polygonRef.current;
    const dm = drawingManagerRef.current;
    if (!polygon || !dm) return;
    polygon.setPath([]);
    polygon.setMap(null);
    polygon.setEditable(false);
    dm.setDrawingMode(null);
    setActiveTool(null);
    setAutoDetectMessage('Automatic property detection unavailable. Please draw treatment area manually.');
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

  if (status === 'loading') {
    return <div className="intake-map-shell flex items-center justify-center text-sm text-slate-500">Loading map…</div>;
  }

  if (status === 'error' || mapInitError) {
    return (
      <div className="intake-error">
        {mapInitError || 'Unable to load Google Maps.'}
      </div>
    );
  }

  return (
    <div>
      <div className="intake-map-toolbar">
        <button type="button" className={`intake-map-btn ${activeTool === 'draw' ? 'intake-map-btn--active' : ''}`} onClick={setDrawMode} disabled={!drawingReady}>
          Draw Polygon
        </button>
        <button type="button" className={`intake-map-btn ${activeTool === 'edit' ? 'intake-map-btn--active' : ''}`} onClick={setEditMode} disabled={!drawingReady}>
          Edit Polygon
        </button>
        <button type="button" className="intake-map-btn" onClick={deletePolygon} disabled={!drawingReady}>
          Delete Polygon
        </button>
      </div>
      {autoDetectMessage && (
        <p className="intake-map-hint">{autoDetectMessage}</p>
      )}
      <div ref={mapRef} className="intake-map-shell" />
    </div>
  );
}
