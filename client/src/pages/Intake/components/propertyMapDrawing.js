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
