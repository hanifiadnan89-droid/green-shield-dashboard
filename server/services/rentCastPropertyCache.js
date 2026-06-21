const CACHE = new Map();
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function propertyRecordsCacheKey(normalizedAddress) {
  return normalizedAddress;
}

export function getCachedPropertyRecords(normalizedAddress) {
  const key = propertyRecordsCacheKey(normalizedAddress);
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedPropertyRecords(normalizedAddress, value, ttlMs = DEFAULT_TTL_MS) {
  const key = propertyRecordsCacheKey(normalizedAddress);
  CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearPropertyRecordsCache() {
  CACHE.clear();
}
