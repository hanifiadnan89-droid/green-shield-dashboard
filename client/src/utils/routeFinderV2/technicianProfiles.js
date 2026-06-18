/**
 * Route Finder V2 — technician profile catalog.
 * Used by V2 eligibility enrichment; full scoring integration comes later.
 */

import { PRODUCTION_TECHNICIAN_ROSTER } from './technicianRosterData.js';

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
export const TECHNICIAN_PROFILES = [...PRODUCTION_TECHNICIAN_ROSTER];

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
