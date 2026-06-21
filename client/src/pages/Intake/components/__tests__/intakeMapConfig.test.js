import { describe, expect, it } from 'vitest';
import {
  apply3dPreviewToMap,
  buildIntakeMapOptions,
  canUse3dPreview,
  INTAKE_3D_TILT,
} from '../intakeMapConfig.js';

describe('intakeMapConfig', () => {
  const mockMaps = {
    Map: function Map() {},
    RenderingType: { VECTOR: 'VECTOR' },
  };

  it('builds flat satellite options by default', () => {
    const options = buildIntakeMapOptions({
      center: { lat: 43.65, lng: -70.26 },
      zoom: 19,
      maps: mockMaps,
    });

    expect(options.mapTypeId).toBe('hybrid');
    expect(options.tilt).toBe(0);
    expect(options.tiltInteractionEnabled).toBe(false);
  });

  it('enables vector tilt options when 3D preview is on and map id exists', () => {
    const prev = import.meta.env.VITE_GOOGLE_MAP_ID;
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

    import.meta.env.VITE_GOOGLE_MAP_ID = prev;
  });

  it('reports 3D availability only when map id is configured', () => {
    const prev = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = '';
    expect(canUse3dPreview(mockMaps)).toBe(false);

    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';
    expect(canUse3dPreview(mockMaps)).toBe(true);

    import.meta.env.VITE_GOOGLE_MAP_ID = prev;
  });

  it('applies 3D options to an existing map instance', () => {
    const prev = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';

    const applied = [];
    const map = {
      getHeading: () => 15,
      getTilt: () => INTAKE_3D_TILT,
      setOptions(opts) {
        applied.push(opts);
      },
    };

    expect(apply3dPreviewToMap(map, mockMaps, true)).toBe(true);
    expect(applied[0]).toMatchObject({
      mapId: 'test-map-id',
      renderingType: 'VECTOR',
      tilt: INTAKE_3D_TILT,
      tiltInteractionEnabled: true,
      headingInteractionEnabled: true,
    });

    import.meta.env.VITE_GOOGLE_MAP_ID = prev;
  });
});
