import { describe, expect, it } from 'vitest';
import {
  apply3dPreviewToMap,
  buildIntakeMapOptions,
  canUse3dPreview,
  INTAKE_3D_TILT,
  verify3dPreviewOnMap,
} from '../intakeMapConfig.js';

function createMockMaps() {
  return {
    Map: function Map() {},
    RenderingType: { VECTOR: 'VECTOR', RASTER: 'RASTER' },
    event: {
      addListenerOnce: (_map, event, cb) => {
        if (event === 'idle') {
          globalThis.setTimeout(cb, 0);
        }
        return {};
      },
    },
  };
}

function createMockMap(overrides = {}) {
  const applied = [];
  let tilt = 0;
  let heading = 0;

  return {
    getHeading: () => heading,
    getTilt: () => tilt,
    getRenderingType: () => 'VECTOR',
    getMapTypeId: () => 'hybrid',
    getZoom: () => 19,
    setTilt(value) {
      tilt = value;
    },
    setHeading(value) {
      heading = value;
    },
    setOptions(opts) {
      applied.push(opts);
      if (typeof opts.tilt === 'number') tilt = opts.tilt;
      if (typeof opts.heading === 'number') heading = opts.heading;
    },
    applied,
    ...overrides,
  };
}

describe('intakeMapConfig', () => {
  const mockMaps = createMockMaps();

  it('builds flat satellite options by default', () => {
    const options = buildIntakeMapOptions({
      center: { lat: 43.65, lng: -70.26 },
      zoom: 19,
      maps: mockMaps,
    });

    expect(options.mapTypeId).toBe('hybrid');
    expect(options.tilt).toBe(0);
    expect(options.tiltInteractionEnabled).toBe(false);
    expect(options.mapId).toBeUndefined();
  });

  it('includes mapId at construction when 3D preview is on', () => {
    const prevMapId = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';

    const options = buildIntakeMapOptions({
      center: { lat: 43.65, lng: -70.26 },
      zoom: 19,
      enable3d: true,
      maps: mockMaps,
    });

    expect(options.mapId).toBe('test-map-id');
    expect(options.renderingType).toBe('VECTOR');
    expect(options.tilt).toBe(INTAKE_3D_TILT);
    expect(options.tiltInteractionEnabled).toBe(true);
    expect(options.headingInteractionEnabled).toBe(true);

    import.meta.env.VITE_GOOGLE_MAP_ID = prevMapId;
  });

  it('reports 3D availability only when map id is configured', () => {
    const prevMapId = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = '';
    expect(canUse3dPreview(mockMaps)).toBe(false);

    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';
    expect(canUse3dPreview(mockMaps)).toBe(true);

    import.meta.env.VITE_GOOGLE_MAP_ID = prevMapId;
  });

  it('verifies tilt after a vector map is constructed with mapId', async () => {
    const prevMapId = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';

    const map = createMockMap({ tilt: INTAKE_3D_TILT });

    const result = await verify3dPreviewOnMap(map, mockMaps, { phase: 'test-verify' });

    expect(result.ok).toBe(true);
    expect(result.after.tilt).toBe(INTAKE_3D_TILT);

    import.meta.env.VITE_GOOGLE_MAP_ID = prevMapId;
  });

  it('returns a fallback reason when tilt stays at zero', async () => {
    const prevMapId = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';

    const map = createMockMap({
      setTilt() {},
      getTilt: () => 0,
      getRenderingType: () => 'RASTER',
    });

    const result = await apply3dPreviewToMap(map, mockMaps, true, { phase: 'test-fallback' });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('vector_mode_unavailable');

    import.meta.env.VITE_GOOGLE_MAP_ID = prevMapId;
  });
});
