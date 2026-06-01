/**
 * Visual variant for activity entries — matches Activity Log icon/border priority.
 */
export function getActivityEntryVariant(entry) {
  if (entry.status === 'error') {
    return 'error';
  }
  if (entry.testMode) {
    return 'test';
  }
  return 'success';
}
