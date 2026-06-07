import { SCORING_MODES } from '../../../../utils/routeFinderScoring.js';

/**
 * Stable fingerprint for user search inputs (excludes technician payload refreshes).
 */
export function buildRouteFinderSearchFingerprint({
  geocode,
  timeWindowPreference,
  serviceTypeId,
  commercialDurationMinutes,
  scoringMode,
  activeDate,
  dateStatus = {},
  dateKeys = [],
}) {
  const cachedDates = scoringMode === SCORING_MODES.BEST_AVAILABLE
    ? dateKeys.filter(d => dateStatus[d]?.status === 'cached').sort()
    : null;

  return JSON.stringify({
    lat: geocode?.lat ?? null,
    lng: geocode?.lng ?? null,
    timeWindowPreference: timeWindowPreference ?? null,
    serviceTypeId: serviceTypeId ?? null,
    commercialDurationMinutes: commercialDurationMinutes ?? null,
    scoringMode,
    activeDate: scoringMode === SCORING_MODES.SINGLE_DATE ? (activeDate ?? null) : null,
    cachedDates,
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
