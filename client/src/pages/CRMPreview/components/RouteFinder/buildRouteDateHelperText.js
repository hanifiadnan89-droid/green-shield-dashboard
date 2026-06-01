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
    return 'Log in to FieldRoutes to load schedules. Use the banner above.';
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
