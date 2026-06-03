/** Human-readable map load errors for UI + console. */
export function describeMapLoadError(code, detail = '') {
  const d = detail ? ` (${detail})` : '';
  switch (code) {
    case 'no_key':
      return {
        title: 'Google Maps API key missing',
        hint: 'Set VITE_GOOGLE_MAPS_API_KEY in your environment and rebuild the client (Vite inlines it at build time).',
      };
    case 'no_coordinates':
      return {
        title: 'Route stops missing coordinates',
        hint: 'Stops need lat/lng from FieldRoutes or geocoded lead address before the map can render.',
      };
    case 'auth_failure':
      return {
        title: 'Google Maps authentication failed',
        hint: `Check API key restrictions for this site, billing, and Maps JavaScript API.${d}`,
      };
    case 'referer_denied':
      return {
        title: 'Referer not allowed for this API key',
        hint: 'Add https://green-shield-dashboard.onrender.com/* to HTTP referrer restrictions in Google Cloud.',
      };
    case 'api_not_activated':
      return {
        title: 'Maps JavaScript API not enabled',
        hint: 'Enable “Maps JavaScript API” for your Google Cloud project.',
      };
    case 'invalid_key':
      return {
        title: 'Invalid Google Maps API key',
        hint: 'Verify VITE_GOOGLE_MAPS_API_KEY and rebuild after changing it.',
      };
    case 'timeout':
      return {
        title: 'Google Maps script timed out',
        hint: 'Network or ad-blocker may be blocking maps.googleapis.com.',
      };
    case 'script_error':
      return {
        title: 'Failed to load Google Maps script',
        hint: 'Check the browser console and network tab for maps.googleapis.com.',
      };
    case 'maps_api_unavailable':
      return {
        title: 'Google Maps library unavailable',
        hint: 'The script loaded but google.maps.Map was not found. Rebuild and check API enablement.',
      };
    case 'map_init_error':
      return {
        title: 'Could not initialize the map',
        hint: detail || 'See browser console for details.',
      };
    default:
      return {
        title: 'Map failed to load',
        hint: detail || 'See browser console for details.',
      };
  }
}

/** Map Google console/network error text to our codes when possible. */
export function classifyMapsError(message = '') {
  const m = String(message).toLowerCase();
  if (m.includes('referernotallowed') || m.includes('referer not allowed')) return 'referer_denied';
  if (m.includes('apinotactivated') || m.includes('not activated')) return 'api_not_activated';
  if (m.includes('invalidkey') || m.includes('invalid key')) return 'invalid_key';
  if (m.includes('auth_failure') || m.includes('authentication')) return 'auth_failure';
  if (m.includes('billing')) return 'auth_failure';
  if (m.includes('timeout')) return 'timeout';
  if (m.includes('script')) return 'script_error';
  return 'unknown';
}
