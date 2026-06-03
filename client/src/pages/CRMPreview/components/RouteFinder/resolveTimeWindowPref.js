/** AM / PM or a specific slot key when timePref is "specific". */
export function resolveTimeWindowPref(timePref, specificSlot) {
  if (!timePref) return null;
  if (timePref === 'specific') return specificSlot || null;
  return timePref;
}
