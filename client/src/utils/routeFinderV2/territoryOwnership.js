/**
 * Route Finder V2 — territory ownership safeguard (V2 modifiers only).
 * Prevents neighboring route geometry from overpowering primary corridor ownership.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';
import {
  isLeadInNormalServiceAreas,
  resolveLeadTown,
} from './profileScoringModifiers.js';

/** @typedef {import('./technicianProfiles.js').TechnicianProfile} TechnicianProfile */

/**
 * @typedef {Object} TerritoryOwnershipModifiers
 * @property {Array<{ code: string, label: string, points: number }>} bonuses
 * @property {Array<{ code: string, label: string, points: number }>} penalties
 * @property {string|null} reason
 */

export const TERRITORY_OWNERSHIP_POINTS = {
  primaryCorridorOwnerBonus: 35,
  normalServiceCorridorBonus: 20,
  neighboringTerritoryPenalty: 35,
};

const SEVERE_BACKTRACKING_RISKS = new Set(['High', 'Severe']);

/**
 * Primary corridor owners by town (normalized lowercase key).
 * When defined, only listed technicians receive territory_owner_bonus for that town.
 * @type {Record<string, string[]>}
 */
export const TOWN_PRIMARY_CORRIDOR_OWNERS = {
  scarborough: ['Paige Bullock'],
  portland: ['Paige Bullock'],
  'south portland': ['Paige Bullock'],
  'cape elizabeth': ['Paige Bullock'],
  westbrook: ['Paige Bullock'],
  gorham: ['Chris McGary'],
  windham: ['Chris McGary', 'Paige Bullock'],
  standish: ['Chris McGary'],
  buxton: ['Chris McGary', 'Paige Bullock'],
  'old orchard beach': ['Ian Pratt', 'Patrick Carney'],
  saco: ['Ian Pratt', 'Patrick Carney', 'Jack Johnson'],
  biddeford: ['Patrick Carney', 'Jack Johnson', 'Ian Pratt'],
  'ferry beach': ['Patrick Carney'],
  kennebunk: ['Joseph Willey', 'Jack Johnson'],
  wells: ['Joseph Willey', 'Jack Johnson'],
  ogunquit: ['Joseph Willey', 'Jack Johnson'],
  arundel: ['Jack Johnson', 'Joseph Willey'],
};

function normalizeTown(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeTechName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function resolveCanonicalTechName(techName) {
  const profile = matchTechnicianProfile(techName);
  return profile?.techName ?? String(techName ?? '').trim();
}

function techNamesEquivalent(left, right) {
  return normalizeTechName(resolveCanonicalTechName(left))
    === normalizeTechName(resolveCanonicalTechName(right));
}

/**
 * @param {string|null|undefined} leadTown
 * @returns {string[]}
 */
export function resolvePrimaryCorridorOwners(leadTown) {
  const normalized = normalizeTown(leadTown);
  if (!normalized) return [];

  const direct = TOWN_PRIMARY_CORRIDOR_OWNERS[normalized];
  if (direct?.length) return [...direct];

  for (const [townKey, owners] of Object.entries(TOWN_PRIMARY_CORRIDOR_OWNERS)) {
    if (normalized.includes(townKey) || townKey.includes(normalized)) {
      return [...owners];
    }
  }

  return [];
}

/**
 * @param {string|null|undefined} techName
 * @param {string|null|undefined} leadTown
 * @returns {boolean}
 */
export function isPrimaryCorridorOwner(techName, leadTown) {
  const owners = resolvePrimaryCorridorOwners(leadTown);
  if (!owners.length) return false;
  return owners.some(owner => techNamesEquivalent(owner, techName));
}

/**
 * @param {object} match
 * @returns {boolean}
 */
function hasSevereBacktrackingRisk(match) {
  const risk = match?.bestInsertion?.backtrackingRisk;
  return SEVERE_BACKTRACKING_RISKS.has(risk);
}

/**
 * @param {object} match
 * @returns {boolean}
 */
function isCorridorOwnerCandidateAvailable(match) {
  const v2Profile = match?.v2Profile ?? {};
  if (v2Profile.overHardMaxStops) return false;
  if (v2Profile.serviceCapabilityMatch === false) return false;
  if (hasSevereBacktrackingRisk(match)) return false;
  if (v2Profile.eligibilityStatus === 'disqualified') return false;
  return true;
}

/**
 * @param {Array<object>} matches
 * @param {string|null|undefined} leadTown
 * @returns {string[]}
 */
export function findAvailablePrimaryCorridorOwners(matches = [], leadTown) {
  const owners = resolvePrimaryCorridorOwners(leadTown);
  if (!owners.length) return [];

  return owners.filter((ownerName) => {
    const match = matches.find(row => techNamesEquivalent(row?.techName, ownerName));
    if (!match) return false;
    return isCorridorOwnerCandidateAvailable(match);
  });
}

/**
 * @param {object} match
 * @param {TechnicianProfile|null|undefined} profile
 * @param {string|null|undefined} leadTown
 * @param {string[]} availableOwners
 * @param {boolean} hasSameTownStop
 * @returns {TerritoryOwnershipModifiers}
 */
export function buildTerritoryOwnershipModifiers(
  match,
  profile,
  leadTown,
  availableOwners,
  hasSameTownStop,
) {
  const bonuses = [];
  const penalties = [];
  const reasons = [];

  if (!leadTown || !profile) {
    return { bonuses, penalties, reason: null };
  }

  const primaryOwners = resolvePrimaryCorridorOwners(leadTown);
  const isPrimaryOwner = isPrimaryCorridorOwner(match?.techName, leadTown);
  const inNormalServiceAreas = isLeadInNormalServiceAreas(profile, leadTown);

  if (isPrimaryOwner) {
    bonuses.push({
      code: 'territory_owner_bonus',
      label: `Primary corridor owner for ${leadTown}`,
      points: TERRITORY_OWNERSHIP_POINTS.primaryCorridorOwnerBonus,
    });
    reasons.push(`Primary corridor owner for ${leadTown}`);
  } else if (inNormalServiceAreas && !primaryOwners.length) {
    bonuses.push({
      code: 'territory_owner_bonus',
      label: `Normal service corridor for ${leadTown}`,
      points: TERRITORY_OWNERSHIP_POINTS.normalServiceCorridorBonus,
    });
    reasons.push(`Normal service corridor for ${leadTown}`);
  }

  const shouldApplyNeighboringPenalty = (
    hasSameTownStop
    && availableOwners.length > 0
    && !isPrimaryOwner
    && (
      primaryOwners.length > 0
        ? !isPrimaryCorridorOwner(match?.techName, leadTown)
        : !inNormalServiceAreas
    )
  );

  if (shouldApplyNeighboringPenalty) {
    const ownerLabel = availableOwners.join(' / ');
    penalties.push({
      code: 'neighboring_territory_penalty',
      label: `Neighboring route geometry; ${leadTown} owned by ${ownerLabel}`,
      points: TERRITORY_OWNERSHIP_POINTS.neighboringTerritoryPenalty,
    });
    reasons.push(
      `Neighboring route stop without corridor ownership; ${ownerLabel} available for ${leadTown}`,
    );
  }

  return {
    bonuses,
    penalties,
    reason: reasons.length ? reasons.join('; ') : null,
  };
}

/**
 * Apply territory ownership modifiers to an enriched v2Score object.
 *
 * @param {import('./profileScoringModifiers.js').V2ScoreMetadata} v2Score
 * @param {TerritoryOwnershipModifiers} territoryMods
 * @returns {import('./profileScoringModifiers.js').V2ScoreMetadata}
 */
export function mergeTerritoryOwnershipIntoV2Score(v2Score, territoryMods) {
  if (!territoryMods.bonuses.length && !territoryMods.penalties.length) {
    return v2Score;
  }

  const bonuses = [...v2Score.bonuses, ...territoryMods.bonuses];
  const penalties = [...v2Score.penalties, ...territoryMods.penalties];
  const penaltyPoints = penalties.reduce((sum, item) => sum + item.points, 0);
  const bonusPoints = bonuses.reduce((sum, item) => sum + item.points, 0);
  const adjustment = bonusPoints - penaltyPoints;
  const adjustedTotal = v2Score.baseTotal + adjustment;

  const explanationParts = [];
  if (bonuses.length) {
    explanationParts.push(`Bonuses: ${bonuses.map(item => `${item.label} (+${item.points})`).join(', ')}`);
  }
  if (penalties.length) {
    explanationParts.push(`Penalties: ${penalties.map(item => `${item.label} (-${item.points})`).join(', ')}`);
  }
  if (territoryMods.reason) {
    explanationParts.push(`Territory: ${territoryMods.reason}`);
  }

  return {
    ...v2Score,
    bonuses,
    penalties,
    adjustment,
    adjustedTotal,
    explanation: explanationParts.join('; ') || v2Score.explanation,
  };
}

/**
 * @param {string|null|undefined} leadTown
 * @param {object|null|undefined} lead
 * @returns {string|null}
 */
export function describeTerritoryOwnershipContext(leadTown, lead) {
  if (leadTown) return leadTown;
  return resolveLeadTown(lead);
}
