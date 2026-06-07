import { api } from '../api/client.js';

export function describeGeocodeError(err) {
  const msg = err?.message || 'Unknown error';
  if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
    return 'Could not reach the dashboard geocoding API. Check your connection or reload the page.';
  }
  if (err?.code === 'GEOCODE_RATE_LIMIT') {
    return 'Address lookup is temporarily busy. Pick a suggestion from the dropdown, or wait a few seconds and try again.';
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

/** Resolve address from suggest cache before calling /lookup. */
export function resolveFromSuggestCache(trimmed, suggestCache, suggestions = []) {
  const key = trimmed.toLowerCase();
  const cached = suggestCache?.[key];
  if (Array.isArray(cached) && cached.length > 0) {
    const exact = cached.find(s =>
      s.shortDisplay?.toLowerCase() === key || s.full?.toLowerCase() === key,
    );
    return geocodeFromSuggestion(exact ?? cached[0]);
  }
  if (suggestions.length === 1) {
    return geocodeFromSuggestion(suggestions[0]);
  }
  return null;
}

export async function fetchAddressSuggestions(query) {
  const data = await api.geocode.suggest(query);
  return data.suggestions || [];
}

export async function lookupAddress(query) {
  const data = await api.geocode.lookup(query);
  return data.result;
}
