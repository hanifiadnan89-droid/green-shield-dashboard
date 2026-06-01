export function getDatePillTitle(status, meta, label) {
  switch (status) {
    case 'cached':
      return `Load routes for ${label}`;
    case 'refreshing':
      return 'Loading route data…';
    case 'failed':
      return meta?.error || 'Load failed — use ↻ to retry';
    case 'needs_login':
      return 'FieldRoutes login required';
    case 'missing':
      return 'Not loaded yet — use ↻ or Refresh all';
    default:
      return 'Not available';
  }
}
