/**
 * Shared Route Finder V2 technician profile defaults.
 */

export const STANDARD_CAN_DO_SERVICES = [
  'RIT',
  'IQ',
  'TICK_MOSQUITO',
  'BED_BUG',
  'COMMERCIAL',
  'RESERVICE',
  'FOLLOW_UP',
  'GENERAL',
];

export const STANDARD_PREFERRED_MAX_STOPS = 13;
export const STANDARD_HARD_MAX_STOPS = 18;
export const STANDARD_USUAL_START_TIME = '08:30';
export const STANDARD_USUAL_END_TIME = '17:00';

/**
 * @param {Partial<import('./technicianProfiles.js').TechnicianProfile>} partial
 * @returns {import('./technicianProfiles.js').TechnicianProfile}
 */
export function createStandardTechnicianProfile(partial) {
  return {
    preferredMaxStops: STANDARD_PREFERRED_MAX_STOPS,
    hardMaxStops: STANDARD_HARD_MAX_STOPS,
    usualStartTime: STANDARD_USUAL_START_TIME,
    usualEndTime: STANDARD_USUAL_END_TIME,
    canDoServices: [...STANDARD_CAN_DO_SERVICES],
    cannotDoServices: [],
    handlesCommercial: true,
    handlesBedBugs: true,
    handlesTickMosquito: true,
    handlesRodentWork: true,
    homeBase: {
      address: '',
      town: '',
      state: 'ME',
      lat: null,
      lng: null,
    },
    notes: '',
    aliases: [],
    normalServiceAreas: [],
    ...partial,
    aliases: [...(partial.aliases ?? [])],
    normalServiceAreas: [...(partial.normalServiceAreas ?? [])],
  };
}
