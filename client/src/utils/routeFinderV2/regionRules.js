/**
 * Route Finder V2 — geographic region and service-area rules.
 * Config only; scoring modifiers wired in a later phase.
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

/**
 * @typedef {Object} ServiceAreaGroup
 * @property {string} key
 * @property {string} label
 * @property {string[]} towns
 * @property {number} sameTownBonus
 * @property {number} sameRegionBonus
 * @property {number} normalServiceAreaBonus
 * @property {number} outsideRegionPenalty
 * @property {string} notes
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

/** @type {Record<string, ServiceAreaGroup>} */
export const SERVICE_AREA_GROUPS = {
  southern_maine: {
    key: 'southern_maine',
    label: 'Southern Maine',
    towns: [
      'Kittery', 'York', 'York Harbor', 'Cape Neddick', 'Ogunquit', 'Wells', 'Eliot',
      'South Berwick', 'North Berwick', 'Sanford', 'Springvale', 'Alfred', 'Waterboro',
      'Shapleigh', 'Kennebunk', 'Kennebunkport', 'Arundel', 'Biddeford', 'Saco',
      'Old Orchard Beach',
    ],
    sameTownBonus: 6,
    sameRegionBonus: 4,
    normalServiceAreaBonus: 5,
    outsideRegionPenalty: 12,
    notes: 'Prefer clustered southern coastal techs before sending Portland or midcoast techs south.',
  },
  seacoast_nh: {
    key: 'seacoast_nh',
    label: 'Seacoast NH',
    towns: [
      'Dover', 'Somersworth', 'Rochester', 'Exeter', 'Hampton', 'Seabrook', 'Rye',
      'North Hampton', 'Portsmouth', 'Southern NH Seacoast',
    ],
    sameTownBonus: 6,
    sameRegionBonus: 4,
    normalServiceAreaBonus: 5,
    outsideRegionPenalty: 14,
    notes: 'NH jobs should stay with NH-clustered technicians when possible.',
  },
  greater_portland: {
    key: 'greater_portland',
    label: 'Greater Portland',
    towns: [
      'Portland', 'South Portland', 'Cape Elizabeth', 'Scarborough', 'Westbrook',
      'Gorham', 'Windham', 'Buxton', 'Standish', 'Old Orchard Beach', 'Saco',
    ],
    sameTownBonus: 6,
    sameRegionBonus: 4,
    normalServiceAreaBonus: 5,
    outsideRegionPenalty: 10,
    notes: 'Avoid pulling a Kennebunk tech into Portland unless no Portland-area route is viable.',
  },
  kennebunk_wells_sanford: {
    key: 'kennebunk_wells_sanford',
    label: 'Kennebunk / Wells / Sanford area',
    towns: [
      'Kennebunk', 'Kennebunkport', 'Wells', 'Ogunquit', 'Sanford', 'Springvale',
      'Arundel', 'Alfred', 'Lyman', 'Waterboro', 'Shapleigh',
    ],
    sameTownBonus: 7,
    sameRegionBonus: 5,
    normalServiceAreaBonus: 6,
    outsideRegionPenalty: 12,
    notes: 'Prefer Joseph Willey / Jack / Patrick-style coastal clusters before Portland techs.',
  },
  brunswick_midcoast: {
    key: 'brunswick_midcoast',
    label: 'Brunswick / Midcoast',
    towns: [
      'Brunswick', 'Topsham', 'Bath', 'Harpswell', 'Freeport', 'Yarmouth', 'Durham',
      'Pownal', 'Lisbon', 'Sabattus', 'Wiscasset',
    ],
    sameTownBonus: 6,
    sameRegionBonus: 4,
    normalServiceAreaBonus: 5,
    outsideRegionPenalty: 12,
    notes: 'Midcoast jobs should stay with Brunswick-area technicians when clustered.',
  },
  oxford_western: {
    key: 'oxford_western',
    label: 'Oxford / Rumford / Western Maine',
    towns: [
      'Oxford', 'Norway', 'South Paris', 'Mechanic Falls', 'Poland', 'Gray', 'Rumford',
      'Mexico', 'Dixfield', 'Bethel', 'Lewiston', 'Auburn',
    ],
    sameTownBonus: 6,
    sameRegionBonus: 4,
    normalServiceAreaBonus: 5,
    outsideRegionPenalty: 14,
    notes: 'Western / interior jobs should not default to coastal techs unless capacity is tight.',
  },
};

const SERVICE_AREA_BY_LABEL = new Map(
  Object.values(SERVICE_AREA_GROUPS).map(group => [normalizeKey(group.label), group]),
);

const TOWN_TO_SERVICE_AREA = new Map();

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

for (const group of Object.values(SERVICE_AREA_GROUPS)) {
  for (const town of group.towns) {
    TOWN_TO_SERVICE_AREA.set(normalizeKey(town), group);
  }
}

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

/**
 * @param {string} keyOrLabel
 * @returns {ServiceAreaGroup|null}
 */
export function getServiceAreaGroup(keyOrLabel) {
  const normalized = normalizeKey(keyOrLabel);
  const direct = SERVICE_AREA_GROUPS[normalized];
  if (direct) return direct;
  return SERVICE_AREA_BY_LABEL.get(normalized) ?? null;
}

/**
 * @returns {ServiceAreaGroup[]}
 */
export function getAllServiceAreaGroups() {
  return Object.values(SERVICE_AREA_GROUPS);
}

/**
 * @param {string|null|undefined} town
 * @returns {ServiceAreaGroup|null}
 */
export function resolveServiceAreaGroupForTown(town) {
  const normalized = normalizeKey(town);
  if (!normalized) return null;
  return TOWN_TO_SERVICE_AREA.get(normalized) ?? null;
}

/**
 * @param {string|null|undefined} addressOrTown
 * @returns {ServiceAreaGroup|null}
 */
export function resolveServiceAreaGroupFromAddress(addressOrTown) {
  const text = String(addressOrTown ?? '');
  if (!text.trim()) return null;

  const parts = text.split(',').map(part => part.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const match = resolveServiceAreaGroupForTown(parts[i]);
    if (match) return match;
  }

  for (const group of Object.values(SERVICE_AREA_GROUPS)) {
    for (const town of group.towns) {
      if (normalizeKey(text).includes(normalizeKey(town))) {
        return group;
      }
    }
  }

  return null;
}
