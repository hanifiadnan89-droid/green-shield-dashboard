import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRoutesApiConfig } from './routesApiConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '../data/route-matrix-cache');

/** @type {Map<string, Promise<unknown>>} */
const inFlightPairRequests = new Map();

function roundCoord(n, decimals = 5) {
  const factor = 10 ** decimals;
  return Math.round(Number(n) * factor) / factor;
}

export function pairCacheKey(origin, destination, { travelMode = 'DRIVE', trafficAware = false } = {}) {
  const prefix = trafficAware ? 'google-routes:traffic' : 'google-routes:drive';
  return `${prefix}:${roundCoord(origin.lat)},${roundCoord(origin.lng)}:${roundCoord(destination.lat)},${roundCoord(destination.lng)}`;
}

function pairTtlMs(trafficAware = false) {
  const config = getRoutesApiConfig();
  const minutes = trafficAware
    ? config.pairCacheTtlMinutesTraffic
    : config.pairCacheTtlMinutesStatic;
  return minutes * 60 * 1000;
}

function routeTtlMs() {
  return getRoutesApiConfig().matrixCacheTtlMinutes * 60 * 1000;
}

const POLYLINE_TTL_MS = 30 * 60 * 1000;

export function routeCacheKey({ date, routeId, travelMode = 'DRIVE', trafficAware = false }) {
  return `${date || 'nodate'}::${routeId || 'noroute'}::${travelMode}::${trafficAware ? 'traffic' : 'static'}`;
}

function pairCacheFile(key) {
  const safe = Buffer.from(key).toString('base64url');
  return path.join(CACHE_DIR, 'pairs', `${safe}.json`);
}

function routeCacheFile(key) {
  const safe = Buffer.from(key).toString('base64url');
  return path.join(CACHE_DIR, 'routes', `${safe}.json`);
}

function readJson(file, ttlMs) {
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    if (!raw?.fetchedAt) return null;
    if (Date.now() - raw.fetchedAt > ttlMs) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeJson(file, payload) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
}

export function getCachedPair(origin, destination, options = {}) {
  const key = pairCacheKey(origin, destination, options);
  const raw = readJson(pairCacheFile(key), pairTtlMs(options.trafficAware));
  if (!raw) return null;
  return raw;
}

export function setCachedPair(origin, destination, result, options = {}) {
  const key = pairCacheKey(origin, destination, options);
  const expiresAt = Date.now() + pairTtlMs(options.trafficAware);
  writeJson(pairCacheFile(key), {
    fetchedAt: Date.now(),
    expiresAt,
    key,
    ...result,
  });
}

/**
 * Deduplicate concurrent identical pair lookups (in-flight promise sharing).
 */
export async function getOrComputePair(origin, destination, options, computeFn) {
  const key = pairCacheKey(origin, destination, options);
  const cached = getCachedPair(origin, destination, options);
  if (cached?.distanceMiles != null) return { result: cached, fromCache: true };

  if (inFlightPairRequests.has(key)) {
    const result = await inFlightPairRequests.get(key);
    return { result, fromCache: true };
  }

  const task = (async () => {
    const again = getCachedPair(origin, destination, options);
    if (again?.distanceMiles != null) return again;
    const computed = await computeFn();
    setCachedPair(origin, destination, computed, options);
    return computed;
  })();

  inFlightPairRequests.set(key, task);
  try {
    const result = await task;
    return { result, fromCache: false };
  } finally {
    inFlightPairRequests.delete(key);
  }
}

export function getCachedRouteMatrix(cacheKey) {
  return readJson(routeCacheFile(cacheKey), routeTtlMs());
}

export function setCachedRouteMatrix(cacheKey, payload) {
  writeJson(routeCacheFile(cacheKey), { fetchedAt: Date.now(), cacheKey, ...payload });
}

function polylineCacheFile(key) {
  const safe = Buffer.from(key).toString('base64url');
  return path.join(CACHE_DIR, 'polylines', `${safe}.json`);
}

export function polylineCacheKey({ date, routeId, stopIds = [], trafficAware = false }) {
  const ids = stopIds.map(String).join(',');
  return `poly::${date || 'nodate'}::${routeId || 'noroute'}::${ids}::${trafficAware ? 'traffic' : 'static'}`;
}

export function getCachedPolyline(cacheKey) {
  return readJson(polylineCacheFile(cacheKey), POLYLINE_TTL_MS);
}

export function setCachedPolyline(cacheKey, payload) {
  writeJson(polylineCacheFile(cacheKey), { fetchedAt: Date.now(), cacheKey, ...payload });
}
