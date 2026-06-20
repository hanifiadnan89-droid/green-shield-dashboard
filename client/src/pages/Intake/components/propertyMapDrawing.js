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

/** Screen-pixel radius to snap closed on the first vertex marker. */
export const POLYGON_CLOSE_THRESHOLD_PX = 24;

function latLngToMapPixel(latLng, map, maps) {
  if (!latLng || !map || !maps?.LatLng) return null;

  const projection = map.getProjection?.();
  const bounds = map.getBounds?.();
  if (!projection || !bounds) return null;

  const zoom = Number(map.getZoom?.());
  if (!Number.isFinite(zoom)) return null;

  const northWest = new maps.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng());
  const nwWorld = projection.fromLatLngToPoint(northWest);
  const pointWorld = projection.fromLatLngToPoint(
    latLng instanceof maps.LatLng ? latLng : new maps.LatLng(latLng.lat, latLng.lng),
  );
  if (!nwWorld || !pointWorld) return null;

  const scale = 2 ** zoom;
  return {
    x: (pointWorld.x - nwWorld.x) * scale,
    y: (pointWorld.y - nwWorld.y) * scale,
  };
}

/**
 * Pixel distance from a map click to the first vertex using DOM + projection.
 * Returns null when the map is not ready to measure screen position.
 */
export function getClickPixelDistanceToFirstVertex(clickPoint, firstVertex, map, maps, mapEvent) {
  if (!clickPoint || !firstVertex || !map || !maps?.LatLng) return null;

  const firstPixel = latLngToMapPixel(
    new maps.LatLng(firstVertex.lat, firstVertex.lng),
    map,
    maps,
  );
  if (!firstPixel) return null;

  const domEvent = mapEvent?.domEvent;
  const mapDiv = map.getDiv?.();
  if (domEvent && mapDiv) {
    const rect = mapDiv.getBoundingClientRect();
    const clickX = domEvent.clientX - rect.left;
    const clickY = domEvent.clientY - rect.top;
    return Math.hypot(clickX - firstPixel.x, clickY - firstPixel.y);
  }

  const clickPixel = latLngToMapPixel(clickPoint, map, maps);
  if (!clickPixel) return null;

  return Math.hypot(clickPixel.x - firstPixel.x, clickPixel.y - firstPixel.y);
}

/**
 * True only when the click is within snap pixels of the first vertex.
 * Requires at least three existing vertices. Never closes on click count alone.
 */
export function shouldClosePolygonOnClick(clickPoint, vertices, maps, map, mapEvent, {
  thresholdPx = POLYGON_CLOSE_THRESHOLD_PX,
} = {}) {
  if (!Array.isArray(vertices) || vertices.length < 3 || !clickPoint) return false;

  const pixelDistance = getClickPixelDistanceToFirstVertex(
    clickPoint,
    vertices[0],
    map,
    maps,
    mapEvent,
  );

  if (pixelDistance === null) return false;

  return pixelDistance <= thresholdPx;
}
