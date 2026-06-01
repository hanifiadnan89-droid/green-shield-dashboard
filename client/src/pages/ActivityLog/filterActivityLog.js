/**
 * Client-side activity log filter — must match legacy ActivityLog.jsx behavior.
 */
export function filterActivityLog(log, filter) {
  if (!filter) {
    return log;
  }
  const q = filter.toLowerCase();
  return log.filter(e =>
    (e.action || '').includes(q) ||
    (e.leadName || '').toLowerCase().includes(q) ||
    (e.template || '').toLowerCase().includes(q) ||
    (e.status || '').includes(q)
  );
}
