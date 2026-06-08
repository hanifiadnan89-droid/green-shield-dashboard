import { api } from '../api/client.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeocodeError(err) {
  return err?.code === 'GEOCODE_RATE_LIMIT'
    || err?.httpStatus === 502
    || err?.httpStatus === 429;
}

async function withGeocodeRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableGeocodeError(err) || i === attempts - 1) throw err;
      await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

export function describeGeocodeError(err) {
  const msg = err?.message || 'Unknown error';
  if (err?.httpStatus === 401) {
    return 'Dashboard login expired — reload the page and sign in again.';
  }
  if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
    return 'Could not reach the dashboard geocoding API. Check your connection or reload the page.';
  }
  if (err?.code === 'GEOCODE_RATE_LIMIT') {
    return 'Address lookup is temporarily busy. Wait a few seconds, then press Enter or pick a suggestion.';
  }
  if (err?.code) {
    return `${msg} (${err.code})`;
  }
  return msg;
}

/** Build geocode result from an autocomplete suggestion (no lookup API call). */
export function geocodeFromSuggestion(suggestion) {
  if (!suggestion?.lat || !suggestion?.lng) return null;
  return {
    lat: suggestion.lat,
    lng: suggestion.lng,
    display: suggestion.shortDisplay,
    full: suggestion.full,
  };
}

/** Pick the best suggestion for a typed address (avoids extra /lookup calls). */
export function pickSuggestionForInput(trimmed, suggestions = []) {
  if (!suggestions.length) return null;
  const key = trimmed.toLowerCase();
  const exact = suggestions.find((s) =>
    s.shortDisplay?.toLowerCase() === key || s.full?.toLowerCase() === key,
  );
  return exact ?? suggestions[0];
}

/** Resolve address from suggest cache before calling /lookup. */
export function resolveFromSuggestCache(trimmed, suggestCache, suggestions = []) {
  const picked = pickSuggestionForInput(trimmed, suggestions);
  if (picked) return geocodeFromSuggestion(picked);

  const key = trimmed.toLowerCase();
  const cached = suggestCache?.[key];
  if (Array.isArray(cached) && cached.length > 0) {
    return geocodeFromSuggestion(pickSuggestionForInput(trimmed, cached));
  }

  // Prefix overlap — user typed more after suggestions loaded, or hit Enter quickly.
  for (const [cacheKey, items] of Object.entries(suggestCache || {})) {
    if (!Array.isArray(items) || items.length === 0) continue;
    if (key.startsWith(cacheKey) || cacheKey.startsWith(key)) {
      return geocodeFromSuggestion(items[0]);
    }
  }

  return null;
}

export async function fetchAddressSuggestions(query) {
  return withGeocodeRetry(async () => {
    const data = await api.geocode.suggest(query);
    return data.suggestions || [];
  });
}

export async function lookupAddress(query) {
  return withGeocodeRetry(async () => {
    const data = await api.geocode.lookup(query);
    return data.result;
  });
}
