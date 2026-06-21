import {
  createCspViolationTracker,
  describe3dFallbackReason,
  logIntake3dDiagnostics,
  readMap3dState,
} from './intakeMap3dDiagnostics.js';

/** Default tilt for 3D preview (within 45–60° range). */
export const INTAKE_3D_TILT = 52;

const MIN_3D_ZOOM = 19;

export function getIntakeMapId() {
  return (import.meta.env.VITE_GOOGLE_MAP_ID || '').trim() || null;
}

export function getVectorRenderingType(maps) {
  return maps?.RenderingType?.VECTOR ?? null;
}

export function canUse3dPreview(maps) {
  return Boolean(getIntakeMapId() && maps?.Map);
}

export function get3dConstructionMapTypeId() {
  return 'roadmap';
}

export function get2dMapTypeId(mapType) {
  return mapType === 'roadmap' ? 'roadmap' : 'hybrid';
}

async function ensureMapsNamespace(maps) {
  if (maps?.RenderingType?.VECTOR) return maps;

  try {
    await window.google?.maps?.importLibrary?.('maps');
  } catch {
    /* classic loader may already expose RenderingType */
  }

  return window.google?.maps ?? maps;
}

function waitForMapIdle(map, maps, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!map || !maps?.event?.addListenerOnce) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    maps.event.addListenerOnce(map, 'idle', () => finish(true));
    globalThis.setTimeout?.(() => finish(false), timeoutMs);
  });
}

function applyTiltAndHeading(map) {
  if (!map) return;

  try {
    map.setTilt?.(INTAKE_3D_TILT);
    if (typeof map.getHeading === 'function' && typeof map.setHeading === 'function') {
      const heading = map.getHeading();
      if (Number.isFinite(heading)) map.setHeading(heading);
    }
  } catch {
    /* map may be tearing down */
  }
}

function ensureVectorRoadmapFor3d(map) {
  if (!map?.setMapTypeId) return;

  try {
    if (map.getMapTypeId?.() !== 'roadmap') {
      map.setMapTypeId('roadmap');
    }
  } catch {
    /* map may be tearing down */
  }
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
  const use3d = enable3d && Boolean(mapId);
  const zoomLevel = Number(zoom);
  const safeZoom = Number.isFinite(zoomLevel) ? zoomLevel : MIN_3D_ZOOM;

  const options = {
    center,
    zoom: use3d && safeZoom < MIN_3D_ZOOM ? MIN_3D_ZOOM : safeZoom,
    mapTypeId: use3d ? get3dConstructionMapTypeId() : get2dMapTypeId(mapType),
    streetViewControl: false,
    mapTypeControl: false,
    tilt: 0,
    heading: 0,
    tiltInteractionEnabled: false,
    headingInteractionEnabled: false,
    ...extra,
  };

  // mapId MUST be set at construction — Google Maps does not allow changing it later.
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
 * Verify 3D preview after the map was constructed with mapId (enable3d: true).
 */
export async function verify3dPreviewOnMap(map, maps, { phase = 'verify' } = {}) {
  const before = readMap3dState(map, maps);

  if (!map?.setOptions) {
    const result = { ok: false, reason: 'no_map_instance', before, after: before };
    logIntake3dDiagnostics(phase, result);
    return result;
  }

  if (!getIntakeMapId()) {
    const result = { ok: false, reason: 'no_map_id', before, after: before };
    logIntake3dDiagnostics(phase, result);
    return result;
  }

  const mapsApi = await ensureMapsNamespace(maps);
  const cspTracker = createCspViolationTracker();

  try {
    await waitForMapIdle(map, mapsApi);
    ensureVectorRoadmapFor3d(map);

    const currentZoom = Number(map.getZoom?.());
    if (Number.isFinite(currentZoom) && currentZoom < MIN_3D_ZOOM) {
      map.setZoom?.(MIN_3D_ZOOM);
    }

    await waitForMapIdle(map, mapsApi);
    applyTiltAndHeading(map);
    await waitForMapIdle(map, mapsApi, 1500);
  } finally {
    cspTracker.stop();
  }

  const after = readMap3dState(map, mapsApi);
  const vectorType = getVectorRenderingType(mapsApi);
  let ok = after.tilt > 0;
  let reason = ok ? 'tilt_applied' : 'tilt_zero_at_location';

  if (!vectorType) {
    reason = 'no_vector_rendering_type';
    ok = after.tilt > 0;
  } else if (!after.isVectorRendering && after.tilt <= 0) {
    reason = 'vector_mode_unavailable';
    ok = false;
  }

  if (!ok && cspTracker.hasMaps3dViolation()) {
    reason = 'csp_blocked';
  }

  if (!ok && after.tilt <= 0) {
    reason = reason === 'tilt_applied' ? 'tilt_timeout' : reason;
  }

  const result = { ok, reason, before, after };
  logIntake3dDiagnostics(phase, {
    ...result,
    extra: {
      fallback: ok ? null : describe3dFallbackReason(reason, after),
      cspViolations: cspTracker.getViolations(),
      note: '3D uses vector roadmap at construction; hybrid/satellite skipped while 3D is active',
    },
  });
  return result;
}

/** @deprecated Use verify3dPreviewOnMap after constructing the map with enable3d: true */
export async function apply3dPreviewToMap(map, maps, enable3d, options = {}) {
  if (!enable3d) {
    const before = readMap3dState(map, maps);
    const result = { ok: true, reason: 'disabled', before, after: before };
    logIntake3dDiagnostics(options.phase || 'disable', result);
    return result;
  }
  return verify3dPreviewOnMap(map, maps, options);
}
