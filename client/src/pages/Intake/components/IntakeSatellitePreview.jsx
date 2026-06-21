import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import { isCompactPolygon } from './propertyMapDrawing.js';
import IntakeMapViewToolbar from './IntakeMapViewToolbar.jsx';
import IntakeMapExpandButton from './IntakeMapExpandButton.jsx';
import IntakeMapExpandedOverlay from './IntakeMapExpandedOverlay.jsx';
import { apply3dPreviewToMap, buildIntakeMapOptions, canUse3dPreview } from './intakeMapConfig.js';
import { useIntakeMapExpanded } from './intakeMapExpanded.js';
import { applyMapType, observeMapContainerResize } from './intakeMapView.js';

/**
 * Read-only intake preview — pin + zoom, optional compact footprint overlay.
 * Expanded view uses a dedicated full-viewport map surface.
 */
export default function IntakeSatellitePreview({
  latitude,
  longitude,
  address,
  footprintPolygon = null,
}) {
  const embeddedMapRef = useRef(null);
  const expandedMapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlaysRef = useRef([]);

  const { status } = useIntakeGoogleMapsLoader();
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState('satellite');
  const [enable3d, setEnable3d] = useState(false);
  const [can3d, setCan3d] = useState(false);

  const {
    isExpanded,
    toggleExpanded,
    closeExpanded,
    getSavedView,
    rememberView,
  } = useIntakeMapExpanded();

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const showFootprint = isCompactPolygon(footprintPolygon);
  const activeContainerRef = isExpanded ? expandedMapRef : embeddedMapRef;

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
    if (status !== 'ready' || !hasCoords) return undefined;

    const container = activeContainerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    let disconnectResize = () => {};

    const maps = window.google?.maps;
    if (!maps?.Map) return undefined;

    setMapReady(false);
    setCan3d(canUse3dPreview(maps));

    const view = getSavedView({ lat, lng }, 20);
    const map = new maps.Map(container, buildIntakeMapOptions({
      center: { lat: view.lat, lng: view.lng },
      zoom: view.zoom,
      mapType,
      enable3d: false,
      maps,
      extra: {
        disableDefaultUI: true,
        zoomControl: true,
        fullscreenControl: false,
        gestureHandling: isExpanded || enable3d ? 'greedy' : 'none',
        keyboardShortcuts: isExpanded,
        clickableIcons: false,
      },
    }));

    mapInstanceRef.current = map;
    renderOverlays(map, maps);
    disconnectResize = observeMapContainerResize(map, container);

    if (!cancelled) setMapReady(true);

    return () => {
      cancelled = true;
      rememberView(map);
      disconnectResize();
      clearOverlays();
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, [status, lat, lng, hasCoords, isExpanded, address, showFootprint, footprintPolygon]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    applyMapType(map, mapType);
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
    map.setOptions({
      gestureHandling: isExpanded || enable3d ? 'greedy' : 'none',
      keyboardShortcuts: isExpanded,
      zoomControl: true,
    });
  }, [isExpanded, enable3d, mapReady]);

  const toolbarProps = {
    mapType,
    onMapTypeChange: setMapType,
    enable3d,
    onEnable3dChange: setEnable3d,
    can3d,
  };

  const mapFrame = (mapRef, { expanded = false } = {}) => (
    <div className={`intake-map-frame${expanded ? ' intake-map-frame--expanded' : ''}`}>
      <div className="intake-map-frame__toolbar">
        <IntakeMapViewToolbar {...toolbarProps} overlay />
      </div>
      <IntakeMapExpandButton
        isExpanded={expanded}
        onClick={() => (expanded
          ? closeExpanded(mapInstanceRef.current)
          : toggleExpanded(mapInstanceRef.current))}
      />
      <div
        ref={mapRef}
        className={`intake-map-shell ${expanded ? 'intake-map-shell--expanded' : 'intake-map-shell--preview'}`}
        aria-label={`${expanded ? 'Expanded' : ''} satellite preview for ${address || 'selected address'}`}
      />
      {!expanded && (
        <div className="intake-preview-map-pin" aria-hidden>
          <MapPin size={14} />
          <span>Service location</span>
        </div>
      )}
    </div>
  );

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
      {!isExpanded && mapFrame(embeddedMapRef)}

      <IntakeMapExpandedOverlay
        open={isExpanded}
        onClose={() => closeExpanded(mapInstanceRef.current)}
      >
        {mapFrame(expandedMapRef, { expanded: true })}
      </IntakeMapExpandedOverlay>
    </div>
  );
}
