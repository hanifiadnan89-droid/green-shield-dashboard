/**
 * Route Finder V2 — geographic region rules.
 * Not wired into live scoring yet.
 */

/** @typedef {'maine'|'new_hampshire'|'general'} RouteRegionKey */

/**
 * @typedef {Object} RegionRule
 * @property {RouteRegionKey} key
 * @property {string} label
 * @property {string[]} matchTerms
 * @property {number} sameTownBonus
 * @property {number} sameRegionBonus
 * @property {number} outsideRegionPenalty
 */

/** @type {Record<RouteRegionKey, RegionRule>} */
export const REGION_RULES = {
  maine: {
    key: 'maine',
    label: 'Maine',
    matchTerms: ['maine', ', me', ' me '],
    sameTownBonus: 6,
    sameRegionBonus: 4,
    outsideRegionPenalty: 12,
  },
  new_hampshire: {
    key: 'new_hampshire',
    label: 'New Hampshire',
    matchTerms: ['new hampshire', ', nh', ' nh '],
    sameTownBonus: 6,
    sameRegionBonus: 4,
    outsideRegionPenalty: 14,
  },
  general: {
    key: 'general',
    label: 'General',
    matchTerms: [],
    sameTownBonus: 4,
    sameRegionBonus: 3,
    outsideRegionPenalty: 10,
  },
};

/**
 * @param {string|null|undefined} routeArea
 * @returns {RegionRule}
 */
export function getRegionRule(routeArea) {
  const key = String(routeArea ?? 'general').trim().toLowerCase();
  if (key === 'maine') return REGION_RULES.maine;
  if (key === 'new_hampshire' || key === 'nh') return REGION_RULES.new_hampshire;
  return REGION_RULES.general;
}

/**
 * @returns {RegionRule[]}
 */
export function getAllRegionRules() {
  return Object.values(REGION_RULES);
}
