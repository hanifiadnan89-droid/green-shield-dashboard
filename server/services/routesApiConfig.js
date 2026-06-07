function readInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readBool(name, fallback = true) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(String(raw).toLowerCase());
}

/** Server-side Google Routes API usage limits (env overrides). */
export function getRoutesApiConfig() {
  return {
    enableRoadTiming: readBool('ROUTES_ENABLE_ROAD_TIMING', true),
    prefilterTopRoutes: readInt('ROUTES_PREFILTER_TOP_ROUTES', 5),
    maxElementsPerSearch: readInt('ROUTES_MAX_ELEMENTS_PER_SEARCH', 250),
    maxElementsPerRoute: readInt('ROUTES_MAX_ELEMENTS_PER_ROUTE', 50),
    maxElementsPerDay: readInt('ROUTES_MAX_ELEMENTS_PER_DAY', 1000),
    matrixCacheTtlMinutes: readInt('ROUTES_MATRIX_CACHE_TTL_MINUTES', 60),
    pairCacheTtlMinutesStatic: readInt('ROUTES_PAIR_CACHE_TTL_STATIC_MINUTES', 24 * 60),
    pairCacheTtlMinutesTraffic: readInt('ROUTES_PAIR_CACHE_TTL_TRAFFIC_MINUTES', 20),
    maxMatrixElementsPerRequest: readInt('ROUTES_MAX_MATRIX_ELEMENTS_PER_REQUEST', 100),
    polylineOnDetailOnly: readBool('ROUTES_POLYLINE_ON_DETAIL_ONLY', true),
  };
}
