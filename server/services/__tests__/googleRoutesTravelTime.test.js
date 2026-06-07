import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeTravelLegs, getGoogleRoutesStatus } from '../googleRoutesTravelTime.js';

const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/route-matrix-cache');

describe('googleRoutesTravelTime', () => {
  const originalKey = process.env.GOOGLE_ROUTES_API_KEY;

  beforeEach(() => {
    delete process.env.GOOGLE_ROUTES_API_KEY;
    vi.restoreAllMocks();
    if (existsSync(CACHE_DIR)) rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    if (originalKey) process.env.GOOGLE_ROUTES_API_KEY = originalKey;
    else delete process.env.GOOGLE_ROUTES_API_KEY;
  });

  it('reports unconfigured status without API key', () => {
    expect(getGoogleRoutesStatus().configured).toBe(false);
    expect(getGoogleRoutesStatus().provider).toBe('haversine');
  });

  it('falls back to haversine when API key is missing', async () => {
    const legs = [{
      origin: { lat: 43.36, lng: -70.58 },
      destination: { lat: 43.32, lng: -70.55 },
    }];
    const result = await computeTravelLegs({ legs, context: { routeId: 'test-haversine-fallback' } });
    expect(result.legs[0].provider).toBe('haversine');
    expect(result.diagnostics.fallbackUsed).toBe(true);
    expect(result.legs[0].distanceMiles).toBeGreaterThan(0);
    expect(result.budget).toBeTruthy();
  });

  it('uses cache on second identical origin/destination request', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        originIndex: 0,
        destinationIndex: 0,
        distanceMeters: 8046,
        duration: '600s',
        status: 'OK',
      }]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const legs = [{
      origin: { lat: 44.01, lng: -69.12 },
      destination: { lat: 43.88, lng: -69.45 },
    }];

    const first = await computeTravelLegs({ legs, context: { routeId: 'cache-test' } });
    const second = await computeTravelLegs({ legs, context: { routeId: 'cache-test-2' } });

    expect(first.legs[0].provider).toBe('google-routes');
    expect(second.diagnostics.cacheHits).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses Google matrix response when key is present', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          originIndex: 0,
          destinationIndex: 0,
          distanceMeters: 8046,
          duration: '600s',
          status: 'OK',
        },
      ]),
    }));

    const legs = [{
      origin: { lat: 44.01, lng: -69.12 },
      destination: { lat: 43.88, lng: -69.45 },
    }];
    const result = await computeTravelLegs({ legs, context: { routeId: 'test-google-parse' } });
    expect(result.legs[0].provider).toBe('google-routes');
    expect(result.legs[0].accuracy).toBe('road-based');
    expect(result.legs[0].travelMinutes).toBe(10);
  });

  it('falls back to pairwise billing when route exceeds per-route element budget', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        originIndex: 0,
        destinationIndex: 0,
        distanceMeters: 5000,
        duration: '400s',
        status: 'OK',
      }]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const origins = Array.from({ length: 8 }, (_, i) => ({ lat: 43 + i * 0.1, lng: -70 }));
    const destinations = Array.from({ length: 8 }, (_, i) => ({ lat: 44 + i * 0.1, lng: -71 }));
    const legs = origins.flatMap(o => destinations.map(d => ({ origin: o, destination: d })));

    const result = await computeTravelLegs({
      legs,
      context: {
        routeId: 'budget-test',
        budget: { maxElementsPerRoute: 50, remainingSearchElements: 250 },
      },
    });

    expect(result.diagnostics.pairwiseMode).toBe(true);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(result.legs.every(l => l.provider === 'google-routes')).toBe(true);
  });

  it('does not expose API key in response payload', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'secret-server-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network fail')));
    const result = await computeTravelLegs({
      legs: [{ origin: { lat: 1, lng: 1 }, destination: { lat: 2, lng: 2 } }],
    });
    expect(JSON.stringify(result)).not.toContain('secret-server-key');
  });
});
