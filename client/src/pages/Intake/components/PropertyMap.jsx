import { useEffect, useRef, useState } from 'react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import {
  computePolygonAreaAcres,
  computePolygonAreaSqFt,
  formatAcreage,
  formatSquareFeet,
} from '../../../utils/intake/polygonArea.js';

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
  const { status } = useIntakeGoogleMapsLoader();
  const [activeTool, setActiveTool] = useState(null);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !center) return undefined;

    const maps = window.google.maps;
    const lat = Number(center.lat);
    const lng = Number(center.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

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

    const emitArea = (path) => {
      const acres = computePolygonAreaAcres(path);
      const sqFt = computePolygonAreaSqFt(path);
      onAreaChange?.({
        treatmentAcreage: Number(formatAcreage(acres)),
        treatmentSquareFeet: Number(String(formatSquareFeet(sqFt)).replace(/,/g, '')),
        rawAcreage: acres,
        rawSquareFeet: sqFt,
      });
    };

    const pathToArray = () => {
      const path = polygon.getPath();
      const out = [];
      for (let i = 0; i < path.getLength(); i += 1) {
        const pt = path.getAt(i);
        out.push({ lat: pt.lat(), lng: pt.lng() });
      }
      return out;
    };

    const syncPolygon = () => {
      const arr = pathToArray();
      onPolygonChange?.(arr);
      emitArea(arr);
    };

    maps.event.addListener(polygon.getPath(), 'set_at', syncPolygon);
    maps.event.addListener(polygon.getPath(), 'insert_at', syncPolygon);
    maps.event.addListener(polygon.getPath(), 'remove_at', syncPolygon);

    if (polygonPath.length >= 3) {
      emitArea(polygonPath);
    }

    const drawingManager = new maps.drawing.DrawingManager({
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

    maps.event.addListener(drawingManager, 'overlaycomplete', (event) => {
      if (event.type !== 'polygon') return;
      polygon.setMap(null);
      event.overlay.setMap(null);
      const newPath = event.overlay.getPath();
      polygon.setPath(newPath);
      polygon.setMap(map);
      polygon.setEditable(true);
      drawingManager.setDrawingMode(null);
      setActiveTool(null);
      syncPolygon();
    });

    return () => {
      polygon.setMap(null);
      drawingManager.setMap(null);
      mapInstanceRef.current = null;
      polygonRef.current = null;
      drawingManagerRef.current = null;
    };
  }, [status, center?.lat, center?.lng, mapType]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setMapTypeId(mapType === 'roadmap' ? 'roadmap' : 'hybrid');
  }, [mapType]);

  function setDrawMode() {
    const dm = drawingManagerRef.current;
    if (!dm) return;
    dm.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
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
    onPolygonChange?.([]);
    onAreaChange?.({
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

  if (status === 'error') {
    return <div className="intake-error">Unable to load Google Maps.</div>;
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
