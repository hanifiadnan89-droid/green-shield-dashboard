import { api } from '../api/client.js';

export function describeGeocodeError(err) {
  const msg = err?.message || 'Unknown error';
  if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
    return 'Could not reach the dashboard geocoding API. Check your connection or reload the page.';
  }
  if (err?.code) {
    return `${msg} (${err.code})`;
  }
  return msg;
}

export async function fetchAddressSuggestions(query) {
  const data = await api.geocode.suggest(query);
  return data.suggestions || [];
}

export async function lookupAddress(query) {
  const data = await api.geocode.lookup(query);
  return data.result;
}
