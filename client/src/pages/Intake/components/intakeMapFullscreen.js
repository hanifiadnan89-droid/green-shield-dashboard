import { useCallback, useEffect, useRef, useState } from 'react';

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

export async function exitMapFullscreen() {
  if (typeof document === 'undefined') return;
  await document.exitFullscreen?.()
    || document.webkitExitFullscreen?.();
}

export async function toggleMapFullscreen(mapEl) {
  if (!mapEl) return;

  const fs = getFullscreenElement();
  if (fs) {
    await exitMapFullscreen();
    return;
  }

  await mapEl.requestFullscreen?.()
    || mapEl.webkitRequestFullscreen?.();
}

/**
 * Google Maps keeps its canvas at the size from init until resize is triggered.
 * Fire multiple times so layout has settled after fullscreen transitions.
 */
export function notifyMapResize(map) {
  const mapsEvent = globalThis.google?.maps?.event;
  if (!map || !mapsEvent) return;

  const trigger = () => {
    try {
      mapsEvent.trigger(map, 'resize');
    } catch {
      /* map may be tearing down */
    }
  };

  trigger();
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => {
      trigger();
      globalThis.requestAnimationFrame(trigger);
    });
  }
  globalThis.setTimeout?.(trigger, 50);
  globalThis.setTimeout?.(trigger, 200);
}
export function useMapContainerResize(mapInstanceRef, containerRef, enabled = true) {
  useEffect(() => {
    if (!enabled || !containerRef?.current || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const element = containerRef.current;
    const observer = new ResizeObserver(() => {
      notifyMapResize(mapInstanceRef.current);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, mapInstanceRef, enabled]);
}

export function useIntakeMapFullscreen(
  mapElRef,
  mapInstanceRef,
  mapReady,
  {
    mapContainerRef = null,
    onFullscreenChange = null,
  } = {},
) {
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [fullscreenHost, setFullscreenHost] = useState(null);
  const onFullscreenChangeRef = useRef(onFullscreenChange);

  useEffect(() => {
    onFullscreenChangeRef.current = onFullscreenChange;
  }, [onFullscreenChange]);

  const syncFullscreen = useCallback(() => {
    const mapEl = mapElRef.current;
    const fs = getFullscreenElement();
    const active = isMapInFullscreen(mapEl);
    setIsMapFullscreen(active);
    setFullscreenHost(active ? fs : null);

    const map = mapInstanceRef.current;
    onFullscreenChangeRef.current?.(active, map);
    notifyMapResize(map);
  }, [mapElRef, mapInstanceRef]);

  useEffect(() => {
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    syncFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, [syncFullscreen, mapReady]);

  useMapContainerResize(mapInstanceRef, mapContainerRef, mapReady);

  const toggleFullscreen = useCallback(async () => {
    await toggleMapFullscreen(mapElRef.current);
    globalThis.setTimeout?.(syncFullscreen, 0);
    globalThis.setTimeout?.(syncFullscreen, 100);
  }, [mapElRef, syncFullscreen]);

  return {
    isMapFullscreen,
    fullscreenHost,
    toggleFullscreen,
  };
}
