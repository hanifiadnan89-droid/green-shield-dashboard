/** Normalize route stops for map rendering and labels. */
export function getMapStops(stops = []) {
  return (stops || []).filter(s => s.lat != null && s.lng != null);
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
