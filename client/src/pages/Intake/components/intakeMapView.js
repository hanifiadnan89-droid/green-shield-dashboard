export function captureMapView(map) {
  if (!map?.getCenter) return null;
  const center = map.getCenter();
  if (!center) return null;

  const lat = center.lat?.();
  const lng = center.lng?.();
  const zoom = map.getZoom?.();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    zoom: Number.isFinite(zoom) ? zoom : 19,
  };
}

export function getMapTypeId(mapType) {
  return mapType === 'roadmap' ? 'roadmap' : 'hybrid';
}

export function applyMapType(map, mapType) {
  if (!map?.setMapTypeId) return;
  try {
    map.setMapTypeId(getMapTypeId(mapType));
    notifyMapResize(map);
  } catch {
    /* map may be tearing down */
  }
}

/**
 * Google Maps keeps its canvas at the size from init until resize is triggered.
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

export function observeMapContainerResize(map, container) {
  if (!map || !container || typeof ResizeObserver === 'undefined') {
    return () => {};
  }

  const observer = new ResizeObserver(() => notifyMapResize(map));
  observer.observe(container);
  return () => observer.disconnect();
}
