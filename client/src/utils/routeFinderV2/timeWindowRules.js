/**
 * Route Finder V2 — customer time window rules.
 * Not wired into live scoring yet.
 */

/** Minutes from midnight for 8:00 AM and 6:00 PM workday bounds. */
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 18 * 60;

/**
 * @typedef {Object} TimeWindowRule
 * @property {string} key
 * @property {string} label
 * @property {number} startMinutes
 * @property {number} endMinutes
 * @property {'soft'|'hard'} windowKind
 * @property {'anytime'|'half-day'|'four-hour'|'two-hour'} category
 */

/** @type {Record<string, TimeWindowRule>} */
export const TIME_WINDOW_RULES = {
  ANYTIME: {
    key: 'ANYTIME',
    label: '8:00 AM–6:00 PM',
    startMinutes: DAY_START_MIN,
    endMinutes: DAY_END_MIN,
    windowKind: 'soft',
    category: 'anytime',
  },
  AT: {
    key: 'AT',
    label: '8:00 AM–6:00 PM',
    startMinutes: DAY_START_MIN,
    endMinutes: DAY_END_MIN,
    windowKind: 'soft',
    category: 'anytime',
  },
  AM: {
    key: 'AM',
    label: '8:00 AM–12:00 PM',
    startMinutes: DAY_START_MIN,
    endMinutes: 12 * 60,
    windowKind: 'soft',
    category: 'half-day',
  },
  PM: {
    key: 'PM',
    label: '12:00 PM–6:00 PM',
    startMinutes: 12 * 60,
    endMinutes: DAY_END_MIN,
    windowKind: 'soft',
    category: 'half-day',
  },
  '8-12': {
    key: '8-12',
    label: '8:00 AM–12:00 PM',
    startMinutes: DAY_START_MIN,
    endMinutes: 12 * 60,
    windowKind: 'soft',
    category: 'four-hour',
  },
  '12-4': {
    key: '12-4',
    label: '12:00 PM–4:00 PM',
    startMinutes: 12 * 60,
    endMinutes: 16 * 60,
    windowKind: 'soft',
    category: 'four-hour',
  },
  '8-10': {
    key: '8-10',
    label: '8:00 AM–10:00 AM',
    startMinutes: 8 * 60,
    endMinutes: 10 * 60,
    windowKind: 'hard',
    category: 'two-hour',
  },
  '10-12': {
    key: '10-12',
    label: '10:00 AM–12:00 PM',
    startMinutes: 10 * 60,
    endMinutes: 12 * 60,
    windowKind: 'hard',
    category: 'two-hour',
  },
  '12-2': {
    key: '12-2',
    label: '12:00 PM–2:00 PM',
    startMinutes: 12 * 60,
    endMinutes: 14 * 60,
    windowKind: 'hard',
    category: 'two-hour',
  },
  '2-4': {
    key: '2-4',
    label: '2:00 PM–4:00 PM',
    startMinutes: 14 * 60,
    endMinutes: 16 * 60,
    windowKind: 'hard',
    category: 'two-hour',
  },
  '4-6': {
    key: '4-6',
    label: '4:00 PM–6:00 PM',
    startMinutes: 16 * 60,
    endMinutes: DAY_END_MIN,
    windowKind: 'hard',
    category: 'two-hour',
  },
};

/**
 * @param {string|null|undefined} pref
 * @returns {TimeWindowRule}
 */
export function getTimeWindowRule(pref) {
  const key = String(pref ?? 'ANYTIME').trim().toUpperCase();
  if (key === 'AT') return TIME_WINDOW_RULES.AT;
  const direct = TIME_WINDOW_RULES[pref ?? ''] ?? TIME_WINDOW_RULES[key];
  return direct ?? TIME_WINDOW_RULES.ANYTIME;
}

/**
 * Parse Route Finder UI preference + optional specific slot.
 * @param {string|null|undefined} pref - AM | PM | specific | AT
 * @param {string|null|undefined} specificSlot - e.g. 8-10 when pref is specific
 * @returns {TimeWindowRule}
 */
export function parseRouteFinderWindow(pref, specificSlot = null) {
  if (pref === 'specific') {
    return getTimeWindowRule(specificSlot || 'ANYTIME');
  }
  return getTimeWindowRule(pref);
}

/**
 * @param {string|null|undefined} pref
 * @returns {boolean}
 */
export function isHardWindow(pref) {
  return getTimeWindowRule(pref).windowKind === 'hard';
}

/**
 * @param {string|null|undefined} pref
 * @returns {boolean}
 */
export function isSoftWindow(pref) {
  return getTimeWindowRule(pref).windowKind === 'soft';
}
