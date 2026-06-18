/**
 * Route Finder V2 — technician profile catalog.
 * Not wired into live scoring yet; used by future V2 algorithm.
 */

/** @typedef {import('./technicianProfiles.js').TechnicianProfile} TechnicianProfile */

/**
 * @typedef {Object} TechnicianProfile
 * @property {string} techName
 * @property {string[]} aliases
 * @property {{ address: string, town: string, state: string, lat: number|null, lng: number|null }} homeBase
 * @property {string[]} normalServiceAreas
 * @property {number} preferredMaxStops
 * @property {number} hardMaxStops
 * @property {string} usualStartTime
 * @property {string} usualEndTime
 * @property {string[]} canDoServices
 * @property {string[]} cannotDoServices
 * @property {boolean} handlesCommercial
 * @property {boolean} handlesBedBugs
 * @property {boolean} handlesTickMosquito
 * @property {boolean} handlesRodentWork
 * @property {string} notes
 */

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** @type {TechnicianProfile[]} */
export const TECHNICIAN_PROFILES = [
  {
    techName: 'Alex Gray',
    aliases: ['A. Gray', 'Alex G.'],
    homeBase: {
      address: '',
      town: 'Portsmouth',
      state: 'NH',
      lat: null,
      lng: null,
    },
    normalServiceAreas: ['Seacoast NH', 'Southern NH'],
    preferredMaxStops: 12,
    hardMaxStops: 16,
    usualStartTime: '8:00 AM',
    usualEndTime: '6:00 PM',
    canDoServices: ['RIT', 'IQ', 'TICK_MOSQUITO', 'GENERAL', 'RESERVICE'],
    cannotDoServices: ['BED_BUG'],
    handlesCommercial: false,
    handlesBedBugs: false,
    handlesTickMosquito: true,
    handlesRodentWork: true,
    notes: 'Primary NH technician from legacy scorer NH config.',
  },
  {
    techName: 'Chris Adams',
    aliases: ['C. Adams'],
    homeBase: {
      address: '',
      town: 'Wells',
      state: 'ME',
      lat: 43.322,
      lng: -70.584,
    },
    normalServiceAreas: ['Southern Maine', 'York County', 'Coastal ME'],
    preferredMaxStops: 14,
    hardMaxStops: 18,
    usualStartTime: '8:00 AM',
    usualEndTime: '6:00 PM',
    canDoServices: ['RIT', 'IQ', 'TICK_MOSQUITO', 'BED_BUG', 'GENERAL', 'RESERVICE'],
    cannotDoServices: [],
    handlesCommercial: true,
    handlesBedBugs: true,
    handlesTickMosquito: true,
    handlesRodentWork: true,
    notes: 'EXAMPLE profile — based on test fixture geography, not production roster.',
  },
  {
    techName: 'Example Tech (Placeholder)',
    aliases: ['Placeholder Tech', 'Example Tech'],
    homeBase: {
      address: '',
      town: 'Saco',
      state: 'ME',
      lat: null,
      lng: null,
    },
    normalServiceAreas: ['Greater Portland', 'Cumberland County'],
    preferredMaxStops: 12,
    hardMaxStops: 15,
    usualStartTime: '8:00 AM',
    usualEndTime: '5:00 PM',
    canDoServices: ['GENERAL', 'FOLLOW_UP'],
    cannotDoServices: ['BED_BUG', 'COMMERCIAL'],
    handlesCommercial: false,
    handlesBedBugs: false,
    handlesTickMosquito: false,
    handlesRodentWork: false,
    notes: 'EXAMPLE placeholder — replace with real roster data in a later pass.',
  },
];

const PROFILE_LOOKUP = new Map();

function registerProfile(profile) {
  const keys = [profile.techName, ...(profile.aliases ?? [])];
  for (const key of keys) {
    const normalized = normalizeName(key);
    if (normalized) PROFILE_LOOKUP.set(normalized, profile);
  }
}

for (const profile of TECHNICIAN_PROFILES) {
  registerProfile(profile);
}

/**
 * @param {string} techName
 * @returns {TechnicianProfile|null}
 */
export function matchTechnicianProfile(techName) {
  const normalized = normalizeName(techName);
  if (!normalized) return null;
  return PROFILE_LOOKUP.get(normalized) ?? null;
}

/**
 * @param {string} techName
 * @returns {TechnicianProfile|null}
 */
export function getTechnicianProfile(techName) {
  return matchTechnicianProfile(techName);
}

/**
 * @param {string} techName
 * @returns {boolean}
 */
export function hasTechnicianProfile(techName) {
  return matchTechnicianProfile(techName) != null;
}

/**
 * @returns {TechnicianProfile[]}
 */
export function getAllTechnicianProfiles() {
  return [...TECHNICIAN_PROFILES];
}
