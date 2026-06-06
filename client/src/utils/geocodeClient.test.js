import { describe, it, expect } from 'vitest';
import {
  describeGeocodeError,
  geocodeFromSuggestion,
  resolveFromSuggestCache,
} from './geocodeClient.js';

describe('geocodeClient', () => {
  it('describes rate limit errors without raw code noise', () => {
    const msg = describeGeocodeError({ code: 'GEOCODE_RATE_LIMIT', message: 'rate limit' });
    expect(msg).toContain('dropdown');
    expect(msg).not.toContain('GEOCODE_RATE_LIMIT');
  });

  it('geocodeFromSuggestion maps suggestion fields', () => {
    const result = geocodeFromSuggestion({
      lat: 43.1,
      lng: -70.2,
      shortDisplay: '1 Main St, Portland, ME',
      full: '1 Main St, Portland, ME 04101',
    });
    expect(result.lat).toBe(43.1);
    expect(result.full).toContain('Portland');
  });

  it('resolveFromSuggestCache uses cached suggestions before lookup', () => {
    const cache = {
      '1 main st portland': [{
        lat: 43.6,
        lng: -70.3,
        shortDisplay: '1 Main St, Portland, ME',
        full: '1 Main St, Portland, ME',
      }],
    };
    const result = resolveFromSuggestCache('1 main st portland', cache, []);
    expect(result?.lat).toBe(43.6);
  });
});
