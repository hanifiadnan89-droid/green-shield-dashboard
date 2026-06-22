export function getIntakeMapId() {
  return (import.meta.env.VITE_GOOGLE_MAP_ID || '').trim() || null;
}

export function get2dMapTypeId(mapType) {
  return mapType === 'roadmap' ? 'roadmap' : 'hybrid';
}

export function canUse3dPreview(maps) {
  return Boolean(maps?.Map && maps?.importLibrary);
}

export function buildIntakeMapOptions({
  center,
  zoom,
  mapType = 'satellite',
  extra = {},
}) {
  const zoomLevel = Number(zoom);

  return {
    center,
    zoom: Number.isFinite(zoomLevel) ? zoomLevel : 19,
    mapTypeId: get2dMapTypeId(mapType),
    streetViewControl: false,
    mapTypeControl: false,
    tilt: 0,
    heading: 0,
    tiltInteractionEnabled: false,
    headingInteractionEnabled: false,
    ...extra,
  };
}
