/**
 * Route Finder V2 — job priority rules for future ranking tweaks.
 * Config only; not applied by live scoring yet.
 */

/**
 * @typedef {Object} PriorityRule
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {number} rankBoost
 * @property {boolean} requiresConfirmation
 */

/** @type {PriorityRule[]} */
export const PRIORITY_RULES = [
  {
    id: 'paid_initial',
    label: 'Paid initial',
    description: 'Paid initial services outrank routine reservice work unless the reservice is marked same-day urgent.',
    rankBoost: 10,
    requiresConfirmation: false,
  },
  {
    id: 'same_day_urgent',
    label: 'Same-day urgent',
    description: 'Same-day urgent jobs should jump ahead of routine work and prefer minimal detour routes.',
    rankBoost: 12,
    requiresConfirmation: true,
  },
  {
    id: 'hard_time_window',
    label: 'Hard time window',
    description: 'Hard customer windows matter heavily and reduce viable insertion options.',
    rankBoost: 9,
    requiresConfirmation: true,
  },
  {
    id: 'customer_must_be_home',
    label: 'Customer must be home',
    description: 'Owner-present jobs create tighter scheduling risk and need stronger time protection.',
    rankBoost: 8,
    requiresConfirmation: true,
  },
  {
    id: 'commercial',
    label: 'Commercial',
    description: 'Commercial jobs may need extra time blocks and stronger time-window protection.',
    rankBoost: 7,
    requiresConfirmation: true,
  },
  {
    id: 'reservice',
    label: 'Re-service',
    description: 'Re-service is lower priority than paid initial unless the job is flagged urgent.',
    rankBoost: 4,
    requiresConfirmation: false,
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    description: 'Follow-up visits are flexible unless customer access or a restricted time window applies.',
    rankBoost: 2,
    requiresConfirmation: false,
  },
  {
    id: 'exterior_only',
    label: 'Exterior-only jobs',
    description: 'Exterior Tick/Mosquito programs are easier to squeeze into a route than interior owner-present work.',
    rankBoost: 1,
    requiresConfirmation: false,
  },
];

const PRIORITY_BY_ID = new Map(PRIORITY_RULES.map(rule => [rule.id, rule]));

/**
 * @param {string} id
 * @returns {PriorityRule|null}
 */
export function getPriorityRule(id) {
  return PRIORITY_BY_ID.get(id) ?? null;
}

/**
 * @returns {PriorityRule[]}
 */
export function getAllPriorityRules() {
  return [...PRIORITY_RULES];
}
