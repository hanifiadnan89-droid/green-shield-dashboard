/** Normalize route stops for map rendering and labels. */
export function getMapStops(stops = []) {
  return (stops || []).filter(s => {
    if (s.lat == null || s.lng == null || s.lat === '' || s.lng === '') return false;
    const lat = Number(s.lat);
    const lng = Number(s.lng);
    return Number.isFinite(lat) && Number.isFinite(lng);
  });
}

/** Whether stops have enough data to draw a route on the map. */
export function getMapCoordinateStatus(stops = []) {
  const total = (stops || []).length;
  const withCoords = getMapStops(stops).length;

  if (total === 0) {
    return { ok: false, code: 'no_stops', total: 0, withCoords: 0 };
  }

  if (withCoords === 0) {
    return { ok: false, code: 'no_coordinates', total, withCoords: 0 };
  }

  if (withCoords < total) {
    return { ok: true, code: 'partial_coordinates', total, withCoords };
  }

  return { ok: true, code: 'ok', total, withCoords };
}

export function getStopMarkerMeta(stops) {
  const list = getMapStops(stops);
  if (!list.length) return [];

  return list.map((stop, index) => {
    const isFirst = index === 0;
    const isLast = index === list.length - 1;
    let role = 'middle';
    if (stop.isNew) role = 'new';
    else if (isFirst) role = 'start';
    else if (isLast) role = 'end';

    return {
      ...stop,
      index: index + 1,
      role,
      label: stop.isNew ? 'N' : String(index + 1),
    };
  });
}

export function getRoutePathCoords(stops) {
  return getMapStops(stops).map(s => ({ lat: s.lat, lng: s.lng }));
}
