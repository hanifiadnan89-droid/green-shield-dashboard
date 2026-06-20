import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import { addMapsListener } from './propertyMapListeners.js';

export default function IntakeSatellitePreview({
  latitude,
  longitude,
  address,
  polygonPath = [],
}) {
  const mapRef = useRef(null);
  const { status } = useIntakeGoogleMapsLoader();

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !hasCoords) return undefined;

    let cancelled = false;
    const cleanups = [];
    let map = null;

    (async () => {
      const maps = window.google?.maps;
      if (!maps?.Map || cancelled || !mapRef.current) return;

      map = new maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 19,
        mapTypeId: 'hybrid',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        clickableIcons: false,
      });

      if (polygonPath.length >= 3) {
        const polygon = new maps.Polygon({
          paths: polygonPath.map((p) => ({ lat: p.lat, lng: p.lng })),
          strokeColor: '#22c55e',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.22,
          clickable: false,
          map,
        });
        const bounds = new maps.LatLngBounds();
        polygonPath.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        const idleCleanup = addMapsListener(map, 'idle', () => {
          map.fitBounds(bounds, 48);
        });
        if (idleCleanup) cleanups.push(idleCleanup);
        void polygon;
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn?.());
    };
  }, [status, lat, lng, hasCoords, JSON.stringify(polygonPath)]);

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

  return <div ref={mapRef} className="intake-map-shell intake-map-shell--preview" aria-label={`Satellite preview for ${address || 'selected address'}`} />;
}
