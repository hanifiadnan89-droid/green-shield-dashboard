/**
 * Route Finder V2 — job priority rules for future ranking tweaks.
 * Not wired into live scoring yet.
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
    description: 'New paid initial service should be prioritized over routine recurring work when capacity is tight.',
    rankBoost: 8,
    requiresConfirmation: false,
  },
  {
    id: 'reservice',
    label: 'Re-service',
    description: 'Callback/re-service visits should slot near related geography when possible.',
    rankBoost: 6,
    requiresConfirmation: false,
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    description: 'Short follow-up visits can flex into tighter gaps.',
    rankBoost: 2,
    requiresConfirmation: false,
  },
  {
    id: 'commercial',
    label: 'Commercial',
    description: 'Commercial jobs may need longer duration blocks and profile-qualified technicians.',
    rankBoost: 4,
    requiresConfirmation: true,
  },
  {
    id: 'exterior_only',
    label: 'Exterior-only jobs',
    description: 'Exterior programs (e.g. tick/mosquito) do not require customer home access.',
    rankBoost: 1,
    requiresConfirmation: false,
  },
  {
    id: 'customer_must_be_home',
    label: 'Customer must be home',
    description: 'Bed bug and some initial visits require confirmed customer presence.',
    rankBoost: 5,
    requiresConfirmation: true,
  },
  {
    id: 'hard_time_window',
    label: 'Hard time window',
    description: 'Narrow customer windows reduce viable insertion options.',
    rankBoost: 7,
    requiresConfirmation: true,
  },
  {
    id: 'same_day_urgent',
    label: 'Same-day urgent',
    description: 'Same-day urgent requests should prefer minimal detour routes.',
    rankBoost: 10,
    requiresConfirmation: true,
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
