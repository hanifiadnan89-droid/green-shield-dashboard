/**
 * @param {{
 *   authNeedsLogin: boolean;
 *   anyDateRefreshing: boolean;
 *   refreshAllPending: boolean;
 *   hasCachedDate: boolean;
 * }} params
 * @returns {string | null}
 */
export function buildRouteDateHelperText({
  authNeedsLogin,
  anyDateRefreshing,
  refreshAllPending,
  hasCachedDate,
}) {
  if (authNeedsLogin) {
    return hasCachedDate
      ? 'Cached schedules are still available. Click Log Back In to refresh from FieldRoutes.'
      : 'Click Log Back In above to connect to FieldRoutes.';
  }
  if (anyDateRefreshing) {
    return refreshAllPending
      ? 'Re-scraping all route dates from FieldRoutes…'
      : 'Syncing schedules from FieldRoutes…';
  }
  if (!hasCachedDate) {
    return 'Dates appear when cache is ready — use ↻ on a date or Refresh all in the header.';
  }
  return null;
}
