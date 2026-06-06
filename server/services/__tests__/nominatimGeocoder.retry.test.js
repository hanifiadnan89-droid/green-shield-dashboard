import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  lookupAddress,
  resetNominatimQueueForTests,
} from '../nominatimGeocoder.js';

describe('nominatimGeocoder rate-limit retry', () => {
  beforeEach(() => {
    resetNominatimQueueForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetNominatimQueueForTests();
  });

  it('retries on HTTP 429 and succeeds on subsequent attempt', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 429, json: async () => [] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [{
          lat: '43.6',
          lon: '-70.3',
          display_name: '1 Test St, Portland, ME 04101',
        }],
      };
    }));

    const promise = lookupAddress('1 Test St Portland ME');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.lat).toBe(43.6);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
