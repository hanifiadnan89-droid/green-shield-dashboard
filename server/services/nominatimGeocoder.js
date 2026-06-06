/**
 * Server-side Nominatim proxy (OpenStreetMap).
 * Browsers must not call nominatim.org directly — Helmet CSP blocks it on Render.
 * No API key required; optional NOMINATIM_BASE_URL override.
 *
 * All outbound calls are serialized (1 req/sec policy) with an in-memory cache
 * so autocomplete + blur/lookup do not burst past Nominatim rate limits.
 */

const NOMINATIM_BASE = (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const USER_AGENT = process.env.NOMINATIM_USER_AGENT
  || 'GreenShieldDashboard/1.0 (route-finder; contact: support@greenshieldpestsolutions.com)';

const ME_VIEWBOX = '-73.0,42.5,-69.5,47.5';
const MIN_INTERVAL_MS = 1500;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_MS = 2500;

/** @type {Promise<unknown>} */
let requestQueue = Promise.resolve();
let lastFetchCompletedAt = 0;
const responseCache = new Map();

function cacheKey(kind, query) {
  return `${kind}:${query.trim().toLowerCase()}`;
}

function cacheGet(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Serialize Nominatim HTTP calls (fixes concurrent suggest/lookup bursts). */
function enqueueNominatim(task) {
  const run = requestQueue.then(() => task());
  requestQueue = run.catch(() => {});
  return run;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function nominatimFetch(pathAndQuery) {
  return enqueueNominatim(async () => {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      const waitMs = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastFetchCompletedAt));
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      if (attempt > 0) {
        const backoffMs = RATE_LIMIT_BASE_MS * (2 ** (attempt - 1));
        await sleep(backoffMs);
      }

      const url = `${NOMINATIM_BASE}${pathAndQuery}`;
      let resp;
      try {
        resp = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        });
      } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        const e = new Error(isTimeout ? 'Geocoding request timed out (15s)' : `Geocoding network error: ${err.message}`);
        e.code = 'GEOCODE_NETWORK';
        throw e;
      } finally {
        lastFetchCompletedAt = Date.now();
      }

      if (resp.status === 429) {
        lastError = new Error('Geocoding rate limit — wait a moment and try again');
        lastError.code = 'GEOCODE_RATE_LIMIT';
        if (attempt < MAX_RATE_LIMIT_RETRIES) {
          console.warn(`[geocode] Nominatim 429 — retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES}`);
          continue;
        }
        throw lastError;
      }

      if (!resp.ok) {
        const e = new Error(`Geocoding service returned HTTP ${resp.status}`);
        e.code = 'GEOCODE_HTTP';
        throw e;
      }

      return resp.json();
    }

    throw lastError ?? new Error('Geocoding failed');
  });
}

export function formatSuggestion(item) {
  const a = item.address || {};
  const streetNum = a.house_number || '';
  const street = a.road || a.pedestrian || a.path || '';
  const primary = [streetNum, street].filter(Boolean).join(' ')
    || item.display_name.split(',')[0].trim();
  const city = a.city || a.town || a.village || a.hamlet || '';
  const state = a.state || '';
  const zip = a.postcode || '';
  const secondary = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const shortDisplay = [primary, secondary].filter(Boolean).join(', ');
  return {
    primary,
    secondary,
    shortDisplay,
    full: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  };
}

export function formatLookupResult(item) {
  const parts = item.display_name.split(',').map((s) => s.trim());
  const short = parts.slice(0, 3).join(', ');
  return {
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    display: short,
    full: item.display_name,
  };
}

export async function searchAddressSuggestions(query, limit = 6) {
  const q = query.trim();
  if (q.length < 4) return [];

  const key = cacheKey('suggest', q);
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: String(limit),
    countrycodes: 'us',
    addressdetails: '1',
    viewbox: ME_VIEWBOX,
    bounded: '0',
  });

  const data = await nominatimFetch(`/search?${params}`);
  if (!Array.isArray(data)) {
    throw new Error('Unexpected geocoding response format');
  }

  const suggestions = data.map(formatSuggestion).filter((s) => s.primary);
  cacheSet(key, suggestions);
  return suggestions;
}

export async function lookupAddress(query) {
  const q = query.trim();
  if (!q) {
    const e = new Error('Address is required');
    e.code = 'GEOCODE_EMPTY';
    throw e;
  }

  const key = cacheKey('lookup', q);
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    countrycodes: 'us',
  });

  const data = await nominatimFetch(`/search?${params}`);
  if (!Array.isArray(data) || data.length === 0) {
    const e = new Error('Address not found — try adding city and state, e.g. 24 Morning St, Portland, ME 04101');
    e.code = 'GEOCODE_NOT_FOUND';
    throw e;
  }

  const result = formatLookupResult(data[0]);
  cacheSet(key, result);
  return result;
}

export function getGeocodeConfigDiagnostics() {
  return {
    provider: 'nominatim',
    baseUrl: NOMINATIM_BASE,
    apiKeyRequired: false,
    proxied: true,
    serialized: true,
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
  };
}

/** @internal test helper */
export function resetNominatimQueueForTests() {
  requestQueue = Promise.resolve();
  lastFetchCompletedAt = 0;
  responseCache.clear();
}
