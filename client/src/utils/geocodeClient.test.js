import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  describeGeocodeError,
  geocodeFromSuggestion,
  pickSuggestionForInput,
  resolveFromSuggestCache,
  fetchAddressSuggestions,
} from './geocodeClient.js';

vi.mock('../api/client.js', () => ({
  api: {
    geocode: {
      suggest: vi.fn(),
      lookup: vi.fn(),
    },
  },
}));

import { api } from '../api/client.js';

describe('geocodeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('describes rate limit errors without raw code noise', () => {
    const msg = describeGeocodeError({ code: 'GEOCODE_RATE_LIMIT', message: 'rate limit' });
    expect(msg).toContain('Enter');
    expect(msg).not.toContain('GEOCODE_RATE_LIMIT');
  });

  it('describes 401 auth errors with reload guidance', () => {
    const msg = describeGeocodeError({ httpStatus: 401, message: 'Unauthorized' });
    expect(msg).toContain('reload');
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

  it('pickSuggestionForInput prefers exact match then first result', () => {
    const suggestions = [
      { shortDisplay: '2 Oak St, Portland, ME', full: '2 Oak St', lat: 1, lng: 2 },
      { shortDisplay: '1 Main St, Portland, ME', full: '1 Main St', lat: 3, lng: 4 },
    ];
    expect(pickSuggestionForInput('1 Main St, Portland, ME', suggestions)?.lat).toBe(3);
    expect(pickSuggestionForInput('partial', suggestions)?.lat).toBe(1);
  });

  it('resolveFromSuggestCache uses live suggestions before lookup', () => {
    const cache = {};
    const suggestions = [{
      lat: 43.6,
      lng: -70.3,
      shortDisplay: '1 Main St, Portland, ME',
      full: '1 Main St, Portland, ME',
    }];
    const result = resolveFromSuggestCache('1 main', cache, suggestions);
    expect(result?.lat).toBe(43.6);
  });

  it('fetchAddressSuggestions retries transient rate-limit failures', async () => {
    api.geocode.suggest
      .mockRejectedValueOnce({ code: 'GEOCODE_RATE_LIMIT', message: 'busy', httpStatus: 502 })
      .mockResolvedValueOnce({ suggestions: [{ shortDisplay: 'x', lat: 1, lng: 2 }] });

    const result = await fetchAddressSuggestions('24 morning st portland');
    expect(result).toHaveLength(1);
    expect(api.geocode.suggest).toHaveBeenCalledTimes(2);
  });
});
