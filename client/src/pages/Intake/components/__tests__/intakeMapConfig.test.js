import { describe, expect, it, vi } from 'vitest';
import {
  buildIntakeMapOptions,
  canUse3dPreview,
  get2dMapTypeId,
} from '../intakeMapConfig.js';
import { getMap3dElementMode, resolveMap3dMode } from '../intakeMap3dElement.js';

describe('intakeMapConfig', () => {
  const mockMaps = {
    Map: function Map() {},
    importLibrary: vi.fn(),
  };

  it('builds flat 2D satellite options', () => {
    const options = buildIntakeMapOptions({
      center: { lat: 43.65, lng: -70.26 },
      zoom: 19,
    });

    expect(options.mapTypeId).toBe('hybrid');
    expect(options.tilt).toBe(0);
    expect(options.mapId).toBeUndefined();
  });

  it('builds roadmap options when map type is roadmap', () => {
    const options = buildIntakeMapOptions({
      center: { lat: 43.65, lng: -70.26 },
      zoom: 19,
      mapType: 'roadmap',
    });

    expect(options.mapTypeId).toBe('roadmap');
  });

  it('reports 3D availability when importLibrary exists', () => {
    expect(canUse3dPreview({ Map: mockMaps.Map })).toBe(false);
    expect(canUse3dPreview(mockMaps)).toBe(true);
  });

  it('maps toolbar types to 2D map type ids', () => {
    expect(get2dMapTypeId('satellite')).toBe('hybrid');
    expect(get2dMapTypeId('roadmap')).toBe('roadmap');
  });
});

describe('intakeMap3dElement modes', () => {
  it('prefers SATELLITE for satellite toolbar and HYBRID for map toolbar', () => {
    expect(getMap3dElementMode('satellite')).toBe('SATELLITE');
    expect(getMap3dElementMode('roadmap')).toBe('HYBRID');
    expect(resolveMap3dMode({ SATELLITE: 'SAT', HYBRID: 'HYB' }, 'satellite')).toBe('SAT');
  });
});
