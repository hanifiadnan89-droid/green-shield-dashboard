import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import { isCompactPolygon } from './propertyMapDrawing.js';

/**
 * Read-only intake preview — pin + zoom only.
 * Optional compact footprint overlay when property-specific and small.
 */
export default function IntakeSatellitePreview({
  latitude,
  longitude,
  address,
  footprintPolygon = null,
}) {
  const mapRef = useRef(null);
  const { status } = useIntakeGoogleMapsLoader();

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const showFootprint = isCompactPolygon(footprintPolygon);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !hasCoords) return undefined;

    let cancelled = false;
    const overlays = [];

    (async () => {
      const maps = window.google?.maps;
      if (!maps?.Map || cancelled || !mapRef.current) return;

      const map = new maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 20,
        mapTypeId: 'hybrid',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        clickableIcons: false,
      });

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
      overlays.push(marker);

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
        overlays.push(polygon);
      }
    })();

    return () => {
      cancelled = true;
      overlays.forEach((overlay) => {
        try {
          overlay?.setMap?.(null);
        } catch {
          /* ignore */
        }
      });
    };
  }, [status, lat, lng, hasCoords, address, showFootprint, footprintPolygon]);

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
    <div className="intake-preview-map-wrap">
      <div ref={mapRef} className="intake-map-shell intake-map-shell--preview" aria-label={`Satellite preview for ${address || 'selected address'}`} />
      <div className="intake-preview-map-pin" aria-hidden>
        <MapPin size={14} />
        <span>Service location</span>
      </div>
    </div>
  );
}
