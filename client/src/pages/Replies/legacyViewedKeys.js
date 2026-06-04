import { VIEWED_KEY } from './constants.js';

/** Legacy sidebar “viewed” keys — must match sync/unread-count for consistent badge counts. */
export function loadLegacyViewedKeys() {
  try {
    return JSON.parse(localStorage.getItem(VIEWED_KEY) || '[]');
  } catch {
    return [];
  }
}
