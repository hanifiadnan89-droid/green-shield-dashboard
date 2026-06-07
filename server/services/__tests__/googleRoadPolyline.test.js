import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeRoadPolyline } from '../googleRoadPolyline.js';

const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/route-matrix-cache');

describe('googleRoadPolyline', () => {
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

  it('returns fallback when API key is missing', async () => {
    const result = await computeRoadPolyline({
      stops: [
        { lat: 43.36, lng: -70.58, stopId: 'a' },
        { lat: 43.32, lng: -70.55, stopId: 'b' },
      ],
      context: { routeId: 'r1', date: '2026-06-09' },
    });
    expect(result.provider).toBe('straight-line');
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('missing_api_key');
    expect(result.encodedPolyline).toBeNull();
  });

  it('requests encoded polyline from computeRoutes', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{
          distanceMeters: 12000,
          duration: '900s',
          polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
          legs: [],
        }],
      }),
    }));

    const result = await computeRoadPolyline({
      stops: [
        { lat: 44.01, lng: -69.12, stopId: 'a' },
        { lat: 43.88, lng: -69.45, stopId: 'b' },
      ],
      context: { routeId: 'r2', date: '2026-06-10' },
    });

    expect(result.provider).toBe('google-routes');
    expect(result.encodedPolyline).toBeTruthy();
    expect(result.fallbackUsed).toBe(false);
    expect(JSON.stringify(result)).not.toContain('test-key');
  });

  it('caches polyline responses', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{
          distanceMeters: 5000,
          duration: '400s',
          polyline: { encodedPolyline: 'abc123' },
          legs: [],
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const input = {
      stops: [
        { lat: 43.1, lng: -70.1, stopId: 'x' },
        { lat: 43.2, lng: -70.2, stopId: 'y' },
      ],
      context: { routeId: 'cache-test', date: '2026-06-11' },
    };

    await computeRoadPolyline(input);
    const second = await computeRoadPolyline(input);
    expect(second.cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
