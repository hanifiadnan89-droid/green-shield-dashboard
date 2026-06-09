import { VIEWED_KEY } from './constants.js';

/** Legacy sidebar “viewed” keys — must match sync/unread-count for consistent badge counts. */
export function loadLegacyViewedKeys() {
  try {
    return JSON.parse(localStorage.getItem(VIEWED_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Persist a viewed inbound key locally (backup when server read state is already saved). */
export function recordLegacyViewedKey(rowNumber, inboundKey) {
  if (!rowNumber || !inboundKey) return;
  const entry = `${rowNumber}:${inboundKey}`;
  try {
    const existing = loadLegacyViewedKeys();
    if (existing.includes(entry)) return;
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...existing, entry]));
  } catch {
    /* ignore quota errors */
  }
}
