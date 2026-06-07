import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchAddressSuggestions,
  resetNominatimQueueForTests,
} from '../nominatimGeocoder.js';

describe('nominatimGeocoder queue', () => {
  beforeEach(() => {
    resetNominatimQueueForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetNominatimQueueForTests();
  });

  it('serializes concurrent suggest requests', async () => {
    const callTimes = [];
    vi.stubGlobal('fetch', vi.fn(async () => {
      callTimes.push(Date.now());
      return {
        ok: true,
        status: 200,
        json: async () => [{
          lat: '43.6',
          lon: '-70.3',
          display_name: '1 Test St, Portland, ME',
          address: { house_number: '1', road: 'Test St', city: 'Portland', state: 'Maine' },
        }],
      };
    }));

    const p1 = searchAddressSuggestions('alpha street portland');
    const p2 = searchAddressSuggestions('beta street portland');

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(callTimes.length).toBe(2);
    if (callTimes.length === 2) {
      expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(1500);
    }
  });

  it('returns cached suggest without second fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{
        lat: '43.6',
        lon: '-70.3',
        display_name: '1 Test St, Portland, ME',
        address: { house_number: '1', road: 'Test St', city: 'Portland', state: 'Maine' },
      }],
    })));

    const q = '34 cloudman st portland';
    await searchAddressSuggestions(q);
    await vi.runAllTimersAsync();
    await searchAddressSuggestions(q);
    await vi.runAllTimersAsync();

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
