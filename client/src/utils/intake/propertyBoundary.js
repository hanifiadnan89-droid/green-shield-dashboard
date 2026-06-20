/**
 * Convert Google Maps LatLngBounds (or plain bounds) into a closed polygon path.
 * @param {unknown} bounds
 * @returns {Array<{ lat: number, lng: number }>|null}
 */
export function boundsToPolygon(bounds) {
  if (!bounds) return null;

  let ne;
  let sw;

  if (typeof bounds.getNorthEast === 'function' && typeof bounds.getSouthWest === 'function') {
    ne = bounds.getNorthEast();
    sw = bounds.getSouthWest();
  } else if (bounds.northeast && bounds.southwest) {
    ne = bounds.northeast;
    sw = bounds.southwest;
  } else if (bounds.north != null && bounds.south != null && bounds.east != null && bounds.west != null) {
    return [
      { lat: bounds.north, lng: bounds.west },
      { lat: bounds.north, lng: bounds.east },
      { lat: bounds.south, lng: bounds.east },
      { lat: bounds.south, lng: bounds.west },
    ];
  } else {
    return null;
  }

  const north = typeof ne?.lat === 'function' ? ne.lat() : ne?.lat;
  const east = typeof ne?.lng === 'function' ? ne.lng() : ne?.lng;
  const south = typeof sw?.lat === 'function' ? sw.lat() : sw?.lat;
  const west = typeof sw?.lng === 'function' ? sw.lng() : sw?.lng;

  if (![north, east, south, west].every(Number.isFinite)) return null;

  const latSpan = Math.abs(north - south);
  const lngSpan = Math.abs(east - west);
  if (latSpan < 0.00001 || lngSpan < 0.00001) return null;
  if (latSpan > 0.05 || lngSpan > 0.05) return null;

  return [
    { lat: north, lng: west },
    { lat: north, lng: east },
    { lat: south, lng: east },
    { lat: south, lng: west },
  ];
}

/**
 * Estimate a reasonable treatment boundary when parcel data is unavailable.
 * @param {{ latitude: number, longitude: number, propertyUseEstimate?: string }} params
 * @returns {Array<{ lat: number, lng: number }>|null}
 */
export function estimateLotBoundary({ latitude, longitude, propertyUseEstimate }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const delta = propertyUseEstimate === 'Commercial' ? 0.00055 : 0.00038;
  return [
    { lat: lat + delta, lng: lng - delta },
    { lat: lat + delta, lng: lng + delta },
    { lat: lat - delta, lng: lng + delta },
    { lat: lat - delta, lng: lng - delta },
  ];
}

/**
 * Pick the best available auto-boundary polygon.
 * @param {{ viewport?: unknown, latitude?: number, longitude?: number, propertyUseEstimate?: string }} source
 * @returns {{ polygon: Array<{ lat: number, lng: number }>, method: 'viewport'|'estimate' }|null}
 */
export function resolveAutoBoundary(source = {}) {
  const fromViewport = boundsToPolygon(source.viewport);
  if (fromViewport?.length >= 3) {
    return { polygon: fromViewport, method: 'viewport' };
  }

  const estimated = estimateLotBoundary(source);
  if (estimated?.length >= 3) {
    return { polygon: estimated, method: 'estimate' };
  }

  return null;
}
