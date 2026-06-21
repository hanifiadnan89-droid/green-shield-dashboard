import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin } from 'lucide-react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import { isCompactPolygon } from './propertyMapDrawing.js';
import IntakeMapViewToolbar from './IntakeMapViewToolbar.jsx';
import {
  apply3dPreviewToMap,
  buildIntakeMapOptions,
  canUse3dPreview,
} from './intakeMapConfig.js';
import { useIntakeMapFullscreen } from './intakeMapFullscreen.js';

/**
 * Read-only intake preview — pin + zoom, optional compact footprint overlay.
 * Supports Satellite / Map / 3D preview and fullscreen expand.
 */
export default function IntakeSatellitePreview({
  latitude,
  longitude,
  address,
  footprintPolygon = null,
}) {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlaysRef = useRef([]);

  const { status } = useIntakeGoogleMapsLoader();
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState('satellite');
  const [enable3d, setEnable3d] = useState(false);
  const [can3d, setCan3d] = useState(false);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const showFootprint = isCompactPolygon(footprintPolygon);

  const { isMapFullscreen, fullscreenHost, toggleFullscreen } = useIntakeMapFullscreen(
    wrapRef,
    mapInstanceRef,
    mapReady,
  );

  function clearOverlays() {
    overlaysRef.current.forEach((overlay) => {
      try {
        overlay?.setMap?.(null);
      } catch {
        /* ignore */
      }
    });
    overlaysRef.current = [];
  }

  function renderOverlays(map, maps) {
    clearOverlays();

    const marker = new maps.Marker({
      position: { lat, lng },
      map,
      title: address || 'Service location',
      zIndex: 3,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#16a34a',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
    overlaysRef.current.push(marker);

    if (showFootprint) {
      const polygon = new maps.Polygon({
        paths: footprintPolygon.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#22c55e',
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: '#22c55e',
        fillOpacity: 0.15,
        clickable: false,
        map,
      });
      overlaysRef.current.push(polygon);
    }
  }

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !hasCoords) return undefined;

    let cancelled = false;

    (async () => {
      const maps = window.google?.maps;
      if (!maps?.Map || cancelled || !mapRef.current) return;

      setMapReady(false);
      setCan3d(canUse3dPreview(maps));

      const map = new maps.Map(mapRef.current, buildIntakeMapOptions({
        center: { lat, lng },
        zoom: 20,
        mapType,
        enable3d: false,
        maps,
        extra: {
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: false,
          gestureHandling: 'none',
          keyboardShortcuts: false,
          clickableIcons: false,
        },
      }));

      mapInstanceRef.current = map;
      renderOverlays(map, maps);
      if (!cancelled) setMapReady(true);
    })();

    return () => {
      cancelled = true;
      clearOverlays();
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, [status, lat, lng, hasCoords]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map?.setCenter || !hasCoords || !mapReady) return;
    map.setCenter({ lat, lng });
    const maps = window.google?.maps;
    if (maps) renderOverlays(map, maps);
  }, [lat, lng, hasCoords, mapReady, showFootprint, footprintPolygon, address]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map?.setMapTypeId || !mapReady) return;
    try {
      map.setMapTypeId(mapType === 'roadmap' ? 'roadmap' : 'hybrid');
    } catch {
      /* map may be tearing down */
    }
  }, [mapType, mapReady]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!map || !mapReady) return;

    if (enable3d) {
      const applied = apply3dPreviewToMap(map, maps, true);
      if (!applied) setEnable3d(false);
    } else {
      apply3dPreviewToMap(map, maps, false);
    }
  }, [enable3d, mapReady]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map?.setOptions || !mapReady) return;
    const interactive = enable3d || isMapFullscreen;
    map.setOptions({
      gestureHandling: interactive ? 'greedy' : 'none',
    });
  }, [enable3d, isMapFullscreen, mapReady]);

  const toolbarProps = {
    mapType,
    onMapTypeChange: setMapType,
    enable3d,
    onEnable3dChange: setEnable3d,
    can3d,
    onExpand: toggleFullscreen,
    isFullscreen: isMapFullscreen,
  };

  const fullscreenToolbar = isMapFullscreen && fullscreenHost
    ? createPortal(
      <IntakeMapViewToolbar {...toolbarProps} overlay />,
      fullscreenHost,
    )
    : null;

  if (!hasCoords) {
    return (
      <div className="intake-preview-panel__map-placeholder">
        <div className="intake-preview-panel__map-placeholder-grid" aria-hidden />
        <MapPin size={28} />
        <p>Satellite preview</p>
        <span>{address || 'Enter an address to preview property intelligence'}</span>
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="intake-map-shell intake-map-shell--preview flex items-center justify-center text-xs text-slate-500">Loading satellite preview…</div>;
  }

  if (status === 'no_key' || status === 'error') {
    return (
      <div className="intake-preview-panel__map-placeholder">
        <MapPin size={28} />
        <p>Map preview unavailable</p>
        <span>{address}</span>
      </div>
    );
  }

  return (
    <div className="intake-preview-map-slot">
      {!isMapFullscreen && <IntakeMapViewToolbar {...toolbarProps} />}

      <div
        ref={wrapRef}
        className={`intake-preview-map-wrap${isMapFullscreen ? ' intake-preview-map-wrap--fullscreen' : ''}`}
      >
        <div
          ref={mapRef}
          className={`intake-map-shell intake-map-shell--preview${isMapFullscreen ? ' intake-map-shell--preview-fullscreen' : ''}`}
          aria-label={`Satellite preview for ${address || 'selected address'}`}
        />
        <div className="intake-preview-map-pin" aria-hidden>
          <MapPin size={14} />
          <span>Service location</span>
        </div>
      </div>

      {fullscreenToolbar}
    </div>
  );
}
