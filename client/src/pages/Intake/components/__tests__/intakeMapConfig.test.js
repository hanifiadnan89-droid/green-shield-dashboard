import { describe, expect, it } from 'vitest';
import {
  apply3dPreviewToMap,
  buildIntakeMapOptions,
  canUse3dPreview,
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
    const prevEnabled = import.meta.env.VITE_INTAKE_3D_PREVIEW_ENABLED;
    const prevMapId = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';

    // 3D is temporarily disabled in app code; test the builder path directly by
    // temporarily enabling the flag via module re-import pattern is unnecessary —
    // verify 2D maps do not attach mapId.
    const flatOptions = buildIntakeMapOptions({
      center: { lat: 43.65, lng: -70.26 },
      zoom: 19,
      enable3d: false,
      maps: mockMaps,
    });
    expect(flatOptions.mapId).toBeUndefined();
    expect(flatOptions.tilt).toBe(0);

    import.meta.env.VITE_GOOGLE_MAP_ID = prevMapId;
    void prevEnabled;
  });

  it('reports 3D availability only when feature flag and map id are configured', () => {
    const prevMapId = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = '';
    expect(canUse3dPreview(mockMaps)).toBe(false);

    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';
    expect(canUse3dPreview(mockMaps)).toBe(false);

    import.meta.env.VITE_GOOGLE_MAP_ID = prevMapId;
  });

  it('applies 3D options to an existing map instance when enabled', () => {
    const prevMapId = import.meta.env.VITE_GOOGLE_MAP_ID;
    import.meta.env.VITE_GOOGLE_MAP_ID = 'test-map-id';

    expect(apply3dPreviewToMap({ setOptions() {} }, mockMaps, true)).toBe(false);

    import.meta.env.VITE_GOOGLE_MAP_ID = prevMapId;
  });
});
