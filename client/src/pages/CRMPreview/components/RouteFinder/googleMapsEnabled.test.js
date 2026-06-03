import { describe, it, expect, vi, afterEach } from 'vitest';
import { isGoogleMapsEnabled } from './useGoogleMapsLoader.js';

describe('isGoogleMapsEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is false when VITE_GOOGLE_MAPS_API_KEY is unset', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    expect(isGoogleMapsEnabled()).toBe(false);
  });

  it('is true when VITE_GOOGLE_MAPS_API_KEY is set', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    expect(isGoogleMapsEnabled()).toBe(true);
  });
});
