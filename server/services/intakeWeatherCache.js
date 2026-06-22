const CACHE = new Map();
const DEFAULT_TTL_MS = 60 * 60 * 1000;

function cacheKey(date, lat, lng) {
  const roundedLat = Number(lat).toFixed(5);
  const roundedLng = Number(lng).toFixed(5);
  return `${date}|${roundedLat}|${roundedLng}`;
}

export function getCachedWeather(date, lat, lng) {
  const key = cacheKey(date, lat, lng);
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedWeather(date, lat, lng, value, ttlMs = DEFAULT_TTL_MS) {
  const key = cacheKey(date, lat, lng);
  CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearWeatherCache() {
  CACHE.clear();
}
