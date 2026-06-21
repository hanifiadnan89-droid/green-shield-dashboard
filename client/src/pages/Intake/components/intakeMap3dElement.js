/**
 * Google Maps Map3DElement (maps3d) — photorealistic Earth-style preview.
 *
 * Requires `google.maps.importLibrary("maps3d")` on the weekly/beta Maps channel.
 * If photorealistic coverage is insufficient, the next escalation path is the
 * Map Tiles API Photorealistic 3D Tiles with a custom renderer (deck.gl / Cesium).
 */
import { getIntakeMapId } from './intakeMapConfig.js';
import { logIntake3dDiagnostics } from './intakeMap3dDiagnostics.js';

export const INTAKE_3D_PHOTOREAL_FALLBACK =
  'Photorealistic 3D is unavailable here. Showing satellite view.';

export const INTAKE_3D_ELEMENT_RANGE = 340;
export const INTAKE_3D_ELEMENT_TILT = 60;
export const INTAKE_3D_ELEMENT_HEADING = 35;

export function getMap3dElementMode(mapType) {
  return mapType === 'roadmap' ? 'HYBRID' : 'SATELLITE';
}

export function resolveMap3dMode(MapMode, mapType) {
  const key = getMap3dElementMode(mapType);
  return MapMode?.[key] ?? key;
}

async function loadMaps3dLibrary() {
  if (!window.google?.maps?.importLibrary) {
    throw new Error('maps_import_unavailable');
  }
  return window.google.maps.importLibrary('maps3d');
}

function waitForMap3dElementReady(element, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    if (!element) {
      resolve({ ok: false, reason: 'no_element' });
      return;
    }

    let settled = false;
    const listeners = [];

    const finish = (result) => {
      if (settled) return;
      settled = true;
      listeners.forEach(([type, handler]) => element.removeEventListener(type, handler));
      resolve(result);
    };

    const onError = () => finish({ ok: false, reason: 'gmp_error' });
    const onMapIdError = () => finish({ ok: false, reason: 'map_id_error' });

    element.addEventListener('gmp-error', onError);
    element.addEventListener('gmp-map-id-error', onMapIdError);
    listeners.push(['gmp-error', onError], ['gmp-map-id-error', onMapIdError]);

    const onSteady = (event) => {
      if (event?.isSteady) {
        finish({
          ok: true,
          reason: 'steady',
          tilt: element.tilt,
          heading: element.heading,
          range: element.range,
          mode: element.mode,
        });
      }
    };

    element.addEventListener('gmp-steadychange', onSteady);
    listeners.push(['gmp-steadychange', onSteady]);

    globalThis.setTimeout?.(() => {
      if (element.isConnected) {
        finish({
          ok: true,
          reason: 'ready_timeout',
          tilt: element.tilt,
          heading: element.heading,
          range: element.range,
          mode: element.mode,
        });
      } else {
        finish({ ok: false, reason: 'init_timeout' });
      }
    }, timeoutMs);
  });
}

/**
 * Mount Google Maps Map3DElement (photorealistic / Earth-style) into a container.
 */
export async function mountIntakeMap3dElement(container, {
  lat,
  lng,
  mapType = 'satellite',
  phase = 'mount',
} = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!container || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const result = { ok: false, reason: 'invalid_mount' };
    logIntake3dDiagnostics(`${phase}-invalid`, {
      before: null,
      after: null,
      ok: false,
      reason: result.reason,
    });
    return result;
  }

  try {
    const maps3d = await loadMaps3dLibrary();
    const { Map3DElement, MapMode } = maps3d;
    const mapId = getIntakeMapId();
    const mode = resolveMap3dMode(MapMode, mapType);

    const element = new Map3DElement({
      center: { lat: latitude, lng: longitude, altitude: 0 },
      mode,
      mapId: mapId || undefined,
      tilt: INTAKE_3D_ELEMENT_TILT,
      heading: INTAKE_3D_ELEMENT_HEADING,
      range: INTAKE_3D_ELEMENT_RANGE,
      gestureHandling: 'GREEDY',
    });

    element.style.width = '100%';
    element.style.height = '100%';
    element.style.display = 'block';

    container.replaceChildren(element);

    const ready = await waitForMap3dElementReady(element);

    const after = {
      mapIdPresent: Boolean(mapId),
      configuredMapId: mapId,
      mode: element.mode ?? mode,
      tilt: element.tilt,
      heading: element.heading,
      range: element.range,
      mapTypeId: mapType,
      zoom: null,
      renderingType: 'Map3DElement',
    };

    const result = {
      ok: ready.ok,
      reason: ready.reason,
      element,
      destroy: () => {
        try {
          element.remove();
        } catch {
          /* ignore */
        }
        if (container) container.replaceChildren();
      },
    };

    logIntake3dDiagnostics(phase, {
      before: { lat: latitude, lng: longitude, mapType },
      after,
      ok: result.ok,
      reason: result.reason,
      extra: {
        fallback: result.ok ? null : INTAKE_3D_PHOTOREAL_FALLBACK,
        note: 'Map3DElement photorealistic surface (maps3d library)',
      },
    });

    return result;
  } catch (error) {
    const result = { ok: false, reason: 'maps3d_load_failed', error };
    logIntake3dDiagnostics(`${phase}-error`, {
      before: { lat: latitude, lng: longitude, mapType },
      after: null,
      ok: false,
      reason: result.reason,
      extra: { error: error?.message },
    });
    return result;
  }
}
