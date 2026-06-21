/** Default tilt for 3D preview (within 45–60° range). */
export const INTAKE_3D_TILT = 52;

/** Temporarily disabled until expanded Satellite/Map view is stable. */
export const INTAKE_3D_PREVIEW_ENABLED = false;

export function getIntakeMapId() {
  return (import.meta.env.VITE_GOOGLE_MAP_ID || '').trim() || null;
}

export function getVectorRenderingType(maps) {
  return maps?.RenderingType?.VECTOR ?? null;
}

export function canUse3dPreview(maps) {
  return INTAKE_3D_PREVIEW_ENABLED && Boolean(getIntakeMapId() && maps?.Map);
}

export function buildIntakeMapOptions({
  center,
  zoom,
  mapType = 'satellite',
  enable3d = false,
  maps,
  extra = {},
}) {
  const mapId = getIntakeMapId();
  const isRoadmap = mapType === 'roadmap';
  const use3d = INTAKE_3D_PREVIEW_ENABLED && enable3d;

  const options = {
    center,
    zoom,
    mapTypeId: isRoadmap ? 'roadmap' : 'hybrid',
    streetViewControl: false,
    mapTypeControl: false,
    tilt: 0,
    heading: 0,
    tiltInteractionEnabled: false,
    headingInteractionEnabled: false,
    ...extra,
  };

  if (mapId && use3d) {
    options.mapId = mapId;
    const vectorType = getVectorRenderingType(maps);
    if (vectorType) {
      options.renderingType = vectorType;
    }
    options.tilt = INTAKE_3D_TILT;
    options.tiltInteractionEnabled = true;
    options.headingInteractionEnabled = true;
  }

  return options;
}

/**
 * Apply or remove 3D preview on an existing map. Returns false when vector/tilt is unavailable.
 */
export function apply3dPreviewToMap(map, maps, enable3d) {
  if (!INTAKE_3D_PREVIEW_ENABLED || !map?.setOptions || !canUse3dPreview(maps)) return false;

  const mapId = getIntakeMapId();
  const options = {
    mapId,
    tilt: enable3d ? INTAKE_3D_TILT : 0,
    heading: enable3d ? (map.getHeading?.() ?? 0) : 0,
    tiltInteractionEnabled: enable3d,
    headingInteractionEnabled: enable3d,
  };

  if (enable3d) {
    const vectorType = getVectorRenderingType(maps);
    if (vectorType) {
      options.renderingType = vectorType;
    }
  }

  try {
    map.setOptions(options);
    const tilt = Number(map.getTilt?.());
    if (enable3d && Number.isFinite(tilt) && tilt <= 0) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
