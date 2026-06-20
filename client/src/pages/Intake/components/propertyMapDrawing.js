/** Max lat/lng span (~200 m) for a preview-safe property footprint */
const COMPACT_SPAN_DEG = 0.002;

export function rectangleToPolygon(cornerA, cornerB) {
  const latA = Number(cornerA?.lat);
  const lngA = Number(cornerA?.lng);
  const latB = Number(cornerB?.lat);
  const lngB = Number(cornerB?.lng);
  if (![latA, lngA, latB, lngB].every(Number.isFinite)) return [];

  const north = Math.max(latA, latB);
  const south = Math.min(latA, latB);
  const east = Math.max(lngA, lngB);
  const west = Math.min(lngA, lngB);

  return [
    { lat: north, lng: west },
    { lat: north, lng: east },
    { lat: south, lng: east },
    { lat: south, lng: west },
  ];
}

export function isCompactPolygon(path, maxSpanDeg = COMPACT_SPAN_DEG) {
  if (!Array.isArray(path) || path.length < 3) return false;
  const lats = path.map((p) => p.lat);
  const lngs = path.map((p) => p.lng);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);
  return latSpan <= maxSpanDeg && lngSpan <= maxSpanDeg;
}

export function pathSpanDegrees(path) {
  if (!Array.isArray(path) || path.length < 2) return { latSpan: 0, lngSpan: 0 };
  const lats = path.map((p) => p.lat);
  const lngs = path.map((p) => p.lng);
  return {
    latSpan: Math.max(...lats) - Math.min(...lats),
    lngSpan: Math.max(...lngs) - Math.min(...lngs),
  };
}


export function createVertexMarker(maps, map, position) {
  if (!maps?.Marker) return null;
  return new maps.Marker({
    position,
    map,
    clickable: false,
    zIndex: 2,
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: 5,
      fillColor: '#16a34a',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    },
  });
}

/** Screen-pixel radius to snap closed on the first vertex. */
export const POLYGON_CLOSE_THRESHOLD_PX = 22;

/** Fallback when map projection is unavailable (small on-purpose). */
export const POLYGON_CLOSE_FALLBACK_METERS = 4;

function haversineMeters(a, b) {
  const latA = Number(a?.lat);
  const lngA = Number(a?.lng);
  const latB = Number(b?.lat);
  const lngB = Number(b?.lng);
  if (![latA, lngA, latB, lngB].every(Number.isFinite)) return Infinity;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat
    + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * sinLng * sinLng;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pixelDistanceToFirstVertex(clickPoint, firstVertex, map, maps, thresholdPx) {
  if (!clickPoint || !firstVertex || !map || !maps?.LatLng) return null;

  const projection = map.getProjection?.();
  if (!projection) return null;

  const zoom = Number(map.getZoom?.());
  if (!Number.isFinite(zoom)) return null;

  const scale = 2 ** zoom;
  const clickLatLng = new maps.LatLng(clickPoint.lat, clickPoint.lng);
  const firstLatLng = new maps.LatLng(firstVertex.lat, firstVertex.lng);
  const worldClick = projection.fromLatLngToPoint(clickLatLng);
  const worldFirst = projection.fromLatLngToPoint(firstLatLng);
  if (!worldClick || !worldFirst) return null;

  const dx = (worldClick.x - worldFirst.x) * scale;
  const dy = (worldClick.y - worldFirst.y) * scale;
  return Math.hypot(dx, dy) <= thresholdPx;
}

/**
 * True when click is within snap range of the first vertex (screen pixels, not click count).
 * Requires at least three existing vertices before closing is considered.
 */
export function shouldClosePolygonOnClick(clickPoint, vertices, maps, map, {
  thresholdPx = POLYGON_CLOSE_THRESHOLD_PX,
  fallbackMeters = POLYGON_CLOSE_FALLBACK_METERS,
} = {}) {
  if (!Array.isArray(vertices) || vertices.length < 3 || !clickPoint) return false;

  const firstVertex = vertices[0];
  const pixelSnap = pixelDistanceToFirstVertex(clickPoint, firstVertex, map, maps, thresholdPx);
  if (pixelSnap === true) return true;
  if (pixelSnap === false) return false;

  return haversineMeters(clickPoint, firstVertex) <= fallbackMeters;
}

/** @deprecated Use shouldClosePolygonOnClick */
export function isNearFirstVertex(clickPoint, firstVertex, maps, thresholdMeters = POLYGON_CLOSE_FALLBACK_METERS) {
  if (!clickPoint || !firstVertex) return false;

  const spherical = maps?.geometry?.spherical;
  if (spherical?.computeDistanceBetween && maps?.LatLng) {
    const a = new maps.LatLng(clickPoint.lat, clickPoint.lng);
    const b = new maps.LatLng(firstVertex.lat, firstVertex.lng);
    return spherical.computeDistanceBetween(a, b) <= thresholdMeters;
  }

  return haversineMeters(clickPoint, firstVertex) <= thresholdMeters;
}
