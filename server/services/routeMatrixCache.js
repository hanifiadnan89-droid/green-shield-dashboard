import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '../data/route-matrix-cache');
const PAIR_TTL_MS = 24 * 60 * 60 * 1000;
const ROUTE_TTL_MS = 30 * 60 * 1000;
const POLYLINE_TTL_MS = 30 * 60 * 1000;

function roundCoord(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

export function pairCacheKey(origin, destination) {
  return [
    roundCoord(origin.lat), roundCoord(origin.lng),
    roundCoord(destination.lat), roundCoord(destination.lng),
  ].join('|');
}

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

export function getCachedPair(origin, destination) {
  const key = pairCacheKey(origin, destination);
  return readJson(pairCacheFile(key), PAIR_TTL_MS);
}

export function setCachedPair(origin, destination, result) {
  const key = pairCacheKey(origin, destination);
  writeJson(pairCacheFile(key), { fetchedAt: Date.now(), key, ...result });
}

export function getCachedRouteMatrix(cacheKey) {
  return readJson(routeCacheFile(cacheKey), ROUTE_TTL_MS);
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
