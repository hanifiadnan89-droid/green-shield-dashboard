import { useEffect, useState } from 'react';

export function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || null;
}

export function isMapInFullscreen(mapEl) {
  const fs = getFullscreenElement();
  if (!fs || !mapEl) return false;
  return fs === mapEl || mapEl.contains(fs) || fs.contains(mapEl);
}

export async function toggleMapFullscreen(mapEl) {
  if (!mapEl) return;

  const fs = getFullscreenElement();
  if (fs) {
    await document.exitFullscreen?.();
    return;
  }

  await mapEl.requestFullscreen?.()
    || mapEl.webkitRequestFullscreen?.();
}

export function useIntakeMapFullscreen(mapElRef, mapInstanceRef, mapReady) {
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [fullscreenHost, setFullscreenHost] = useState(null);

  useEffect(() => {
    const syncFullscreen = () => {
      const mapEl = mapElRef.current;
      const fs = getFullscreenElement();
      const active = isMapInFullscreen(mapEl);
      setIsMapFullscreen(active);
      setFullscreenHost(active ? fs : null);

      const map = mapInstanceRef.current;
      const mapsEvent = window.google?.maps?.event;
      if (map && mapsEvent) {
        mapsEvent.trigger(map, 'resize');
      }
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    syncFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, [mapElRef, mapInstanceRef, mapReady]);

  return {
    isMapFullscreen,
    fullscreenHost,
    toggleFullscreen: () => toggleMapFullscreen(mapElRef.current),
  };
}
