/**
 * Stable fingerprint for user search inputs (excludes technician payload refreshes).
 */
export function buildRouteFinderSearchFingerprint({
  geocode,
  timeWindowPreference,
  serviceTypeId,
  commercialDurationMinutes,
  activeDate,
}) {
  return JSON.stringify({
    lat: geocode?.lat ?? null,
    lng: geocode?.lng ?? null,
    timeWindowPreference: timeWindowPreference ?? null,
    serviceTypeId: serviceTypeId ?? null,
    commercialDurationMinutes: commercialDurationMinutes ?? null,
    activeDate: activeDate ?? null,
  });
}

/**
 * Skip auto-search when background route reload updates technicians but user inputs are unchanged.
 */
export function shouldSkipAutoRouteSearch({
  fingerprint,
  lastFingerprint,
  scoringStatus,
  hasResults,
}) {
  if (!lastFingerprint || fingerprint !== lastFingerprint) return false;
  if (scoringStatus === 'loading') return true;
  return Boolean(hasResults && scoringStatus === 'done');
}
