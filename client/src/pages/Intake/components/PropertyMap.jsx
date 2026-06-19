import { useEffect, useRef, useState } from 'react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import {
  computePolygonAreaAcres,
  computePolygonAreaSqFt,
  formatAcreage,
  formatSquareFeet,
} from '../../../utils/intake/polygonArea.js';
import { addMapsListener, runListenerCleanups } from './propertyMapListeners.js';

export default function PropertyMap({
  center,
  polygonPath = [],
  mapType = 'satellite',
  onPolygonChange,
  onAreaChange,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onAreaChangeRef = useRef(onAreaChange);
  const { status } = useIntakeGoogleMapsLoader();
  const [activeTool, setActiveTool] = useState(null);
  const [mapInitError, setMapInitError] = useState(null);

  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
    onAreaChangeRef.current = onAreaChange;
  }, [onPolygonChange, onAreaChange]);

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

    const pathToArray = (polygon) => {
      const path = polygon?.getPath?.();
      if (!path || typeof path.getLength !== 'function') return [];
      const out = [];
      for (let i = 0; i < path.getLength(); i += 1) {
        const pt = path.getAt(i);
        if (!pt) continue;
        out.push({ lat: pt.lat(), lng: pt.lng() });
      }
      return out;
    };

    const syncPolygon = (polygon) => {
      if (!polygon) return;
      const arr = pathToArray(polygon);
      onPolygonChangeRef.current?.(arr);
      emitArea(arr);
    };

    const attachPolygonPathListeners = (polygon) => {
      const path = polygon?.getPath?.();
      if (!path) return;

      for (const eventName of ['set_at', 'insert_at', 'remove_at']) {
        const cleanup = addMapsListener(path, eventName, () => syncPolygon(polygon));
        if (cleanup) listenerCleanups.push(cleanup);
      }
    };

    (async () => {
      try {
        setMapInitError(null);
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
          paths: polygonPath.map((p) => ({ lat: p.lat, lng: p.lng })),
          strokeColor: '#22c55e',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.25,
          editable: false,
          draggable: false,
          map,
        });

        polygonRef.current = polygon;
        attachPolygonPathListeners(polygon);

        if (polygonPath.length >= 3) {
          emitArea(polygonPath);
        }

        let idleCleanup = null;
        idleCleanup = addMapsListener(map, 'idle', () => {
          idleCleanup?.();
          if (cancelled || drawingManagerRef.current) return;

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

          if (!mapInstanceRef.current) return;

          drawingManager.setMap(mapInstanceRef.current);
          drawingManagerRef.current = drawingManager;

          const overlayCleanup = addMapsListener(drawingManager, 'overlaycomplete', (event) => {
            if (event.type !== 'polygon' || !polygonRef.current || !mapInstanceRef.current) return;

            const activePolygon = polygonRef.current;
            const activeMap = mapInstanceRef.current;
            const activeDrawingManager = drawingManagerRef.current;
            if (!activeDrawingManager) return;

            activePolygon.setMap(null);
            event.overlay?.setMap?.(null);

            const newPath = event.overlay?.getPath?.();
            if (!newPath) return;

            activePolygon.setPath(newPath);
            activePolygon.setMap(activeMap);
            activePolygon.setEditable(true);
            activeDrawingManager.setDrawingMode(null);
            setActiveTool(null);
            syncPolygon(activePolygon);
          });

          if (overlayCleanup) listenerCleanups.push(overlayCleanup);
        });

        if (idleCleanup) listenerCleanups.push(idleCleanup);
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
    };
  }, [status, center?.lat, center?.lng]);

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
    polygon.setEditable(false);
    dm.setDrawingMode(null);
    setActiveTool(null);
    onPolygonChangeRef.current?.([]);
    onAreaChangeRef.current?.({
      treatmentAcreage: 0,
      treatmentSquareFeet: 0,
      rawAcreage: 0,
      rawSquareFeet: 0,
    });
  }

  if (status === 'no_key') {
    return <div className="intake-error">Google Maps API key is not configured.</div>;
  }

  if (status === 'loading') {
    return <div className="intake-map-shell flex items-center justify-center text-sm text-gs-muted">Loading map…</div>;
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
        <button type="button" className={`intake-map-btn ${activeTool === 'draw' ? 'intake-map-btn--active' : ''}`} onClick={setDrawMode}>
          Draw Polygon
        </button>
        <button type="button" className={`intake-map-btn ${activeTool === 'edit' ? 'intake-map-btn--active' : ''}`} onClick={setEditMode}>
          Edit Polygon
        </button>
        <button type="button" className="intake-map-btn" onClick={deletePolygon}>
          Delete Polygon
        </button>
      </div>
      <div ref={mapRef} className="intake-map-shell" />
    </div>
  );
}
