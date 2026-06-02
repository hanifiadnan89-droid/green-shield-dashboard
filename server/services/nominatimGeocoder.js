/**
 * Server-side Nominatim proxy (OpenStreetMap).
 * Browsers must not call nominatim.org directly — Helmet CSP blocks it on Render.
 * No API key required; optional NOMINATIM_BASE_URL override.
 */

const NOMINATIM_BASE = (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const USER_AGENT = process.env.NOMINATIM_USER_AGENT
  || 'GreenShieldDashboard/1.0 (route-finder; contact: support@greenshieldpestsolutions.com)';

const ME_VIEWBOX = '-73.0,42.5,-69.5,47.5';
let lastRequestAt = 0;

async function nominatimFetch(pathAndQuery) {
  const now = Date.now();
  const waitMs = Math.max(0, 1100 - (now - lastRequestAt));
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }
  lastRequestAt = Date.now();

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
  }

  if (resp.status === 429) {
    const e = new Error('Geocoding rate limit — wait a moment and try again');
    e.code = 'GEOCODE_RATE_LIMIT';
    throw e;
  }

  if (!resp.ok) {
    const e = new Error(`Geocoding service returned HTTP ${resp.status}`);
    e.code = 'GEOCODE_HTTP';
    throw e;
  }

  return resp.json();
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

  return data.map(formatSuggestion).filter((s) => s.primary);
}

export async function lookupAddress(query) {
  const q = query.trim();
  if (!q) {
    const e = new Error('Address is required');
    e.code = 'GEOCODE_EMPTY';
    throw e;
  }

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

  return formatLookupResult(data[0]);
}

export function getGeocodeConfigDiagnostics() {
  return {
    provider: 'nominatim',
    baseUrl: NOMINATIM_BASE,
    apiKeyRequired: false,
    proxied: true,
  };
}
