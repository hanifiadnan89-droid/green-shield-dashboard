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

/** Default snap radius when closing a polygon on the first vertex (~20 m). */
export const POLYGON_CLOSE_THRESHOLD_METERS = 20;

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

export function isNearFirstVertex(clickPoint, firstVertex, maps, thresholdMeters = POLYGON_CLOSE_THRESHOLD_METERS) {
  if (!clickPoint || !firstVertex) return false;

  const spherical = maps?.geometry?.spherical;
  if (spherical?.computeDistanceBetween && maps?.LatLng) {
    const a = new maps.LatLng(clickPoint.lat, clickPoint.lng);
    const b = new maps.LatLng(firstVertex.lat, firstVertex.lng);
    return spherical.computeDistanceBetween(a, b) <= thresholdMeters;
  }

  return haversineMeters(clickPoint, firstVertex) <= thresholdMeters;
}
