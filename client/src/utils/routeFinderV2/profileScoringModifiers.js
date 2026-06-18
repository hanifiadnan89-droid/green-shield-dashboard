/**
 * Route Finder V2 — profile/config scoring modifiers.
 * Applies non-breaking v2Score adjustments after the staged scorer and v2Profile enrichment.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';
import { getV2PenaltyConfig } from './scoringWeights.js';
import {
  getRegionRule,
  resolveServiceAreaGroupForTown,
  resolveServiceAreaGroupFromAddress,
} from './regionRules.js';

/** @typedef {import('./technicianEligibility.js').V2ProfileMetadata} V2ProfileMetadata */

/**
 * @typedef {Object} V2ScorePenalty
 * @property {string} code
 * @property {string} label
 * @property {number} points
 */

/**
 * @typedef {Object} V2ScoreBonus
 * @property {string} code
 * @property {string} label
 * @property {number} points
 */

/**
 * @typedef {Object} V2ScoreMetadata
 * @property {number} baseTotal
 * @property {number} adjustedTotal
 * @property {number} adjustment
 * @property {V2ScorePenalty[]} penalties
 * @property {V2ScoreBonus[]} bonuses
 * @property {string} explanation
 */

const ELIGIBILITY_RANK = {
  eligible: 0,
  warning: 1,
  disqualified: 2,
};

/** Large penalty to push hard-limit / service-ineligible candidates below viable options. */
const DISQUALIFYING_PENALTY = 100;

const PROFILE_BONUS_POINTS = {
  matchedProfile: 5,
  serviceCapability: 4,
  underPreferredMax: 3,
  strongGeoCluster: 5,
  nearbyStopSameTown: 4,
  nearbyStopSameRegion: 2,
};

const BACKTRACKING_RISK_PENALTY = new Set(['Moderate', 'High', 'Severe']);

function normalizeTown(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * @param {string|null|undefined} address
 * @returns {string|null}
 */
export function resolveTownFromAddress(address) {
  const text = String(address ?? '').trim();
  if (!text) return null;

  const parts = text.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
      .replace(/\b(ME|NH|Maine|New Hampshire)\b/gi, '')
      .trim();
    return candidate || parts[parts.length - 2];
  }

  return parts[0] || null;
}

/**
 * @param {object|null|undefined} lead
 * @returns {string|null}
 */
export function resolveLeadTown(lead) {
  if (lead?.town) return String(lead.town).trim();
  if (lead?.city) return String(lead.city).trim();

  const fromAddress = resolveTownFromAddress(lead?.address);
  if (fromAddress) return fromAddress;

  const fromGroup = resolveServiceAreaGroupFromAddress(lead?.address);
  if (fromGroup?.towns?.length) return fromGroup.towns[0];

  return null;
}

/**
 * @param {string|null|undefined} left
 * @param {string|null|undefined} right
 * @returns {boolean}
 */
function townsMatch(left, right) {
  const a = normalizeTown(left);
  const b = normalizeTown(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * @param {import('./technicianProfiles.js').TechnicianProfile} profile
 * @param {string|null} leadTown
 * @returns {boolean}
 */
export function isLeadInNormalServiceAreas(profile, leadTown) {
  if (!profile?.normalServiceAreas?.length || !leadTown) return false;
  return profile.normalServiceAreas.some(area => townsMatch(area, leadTown));
}

/**
 * @param {object} match
 * @returns {boolean}
 */
export function isStrongGeoCluster(match) {
  const viability = match?.areaViability?.areaViability;
  if (viability === 'strong') return true;

  const label = String(match?.clusterLabel ?? '').toLowerCase();
  return label.startsWith('strong cluster');
}

/**
 * @param {object} match
 * @returns {boolean}
 */
export function isWeakGeoCluster(match) {
  const viability = match?.areaViability?.areaViability;
  if (viability === 'weak' || viability === 'out_of_area') return true;

  const label = String(match?.clusterLabel ?? '').toLowerCase();
  return label.includes('weak')
    || label.includes('out_of_area')
    || label.includes('out of area')
    || label.startsWith('no stops within');
}

/**
 * @param {object} match
 * @returns {boolean}
 */
function hasBacktrackingRisk(match) {
  const risk = match?.bestInsertion?.backtrackingRisk;
  return BACKTRACKING_RISK_PENALTY.has(risk);
}

/**
 * @param {object} match
 * @param {object|null|undefined} lead
 * @param {Array<{ routeId: string|number, stops?: Array<{ address?: string, customerName?: string }> }>|null|undefined} technicians
 * @returns {Array<{ town: string|null, regionKey: string|null }>}
 */
function collectRouteStopLocations(match, lead, technicians) {
  const locations = [];
  const routeStops = match?.routeStops ?? [];

  for (const stop of routeStops) {
    const town = resolveTownFromAddress(stop?.address) || resolveTownFromAddress(stop?.customerName);
    const region = town ? resolveServiceAreaGroupForTown(town)?.key ?? null : null;
    locations.push({ town, regionKey: region });
  }

  const tech = technicians?.find(t => String(t.routeId) === String(match?.routeId));
  for (const stop of tech?.stops ?? []) {
    const town = resolveTownFromAddress(stop?.address) || resolveTownFromAddress(stop?.customerName);
    const region = town ? resolveServiceAreaGroupForTown(town)?.key ?? null : null;
    locations.push({ town, regionKey: region });
  }

  if (match?.closestStop?.address) {
    const town = resolveTownFromAddress(match.closestStop.address);
    const region = town ? resolveServiceAreaGroupForTown(town)?.key ?? null : null;
    locations.push({ town, regionKey: region });
  }

  if (!locations.length && lead?.address) {
    const town = resolveLeadTown(lead);
    locations.push({
      town,
      regionKey: town ? resolveServiceAreaGroupForTown(town)?.key ?? null : null,
    });
  }

  return locations;
}

/**
 * @param {V2ScorePenalty[]} penalties
 * @param {V2ScoreBonus[]} bonuses
 * @returns {string}
 */
function buildV2ScoreExplanation(penalties, bonuses) {
  const parts = [];
  if (bonuses.length) {
    parts.push(`Bonuses: ${bonuses.map(item => `${item.label} (+${item.points})`).join(', ')}`);
  }
  if (penalties.length) {
    parts.push(`Penalties: ${penalties.map(item => `${item.label} (-${item.points})`).join(', ')}`);
  }
  if (!parts.length) return 'No profile modifiers applied';
  return parts.join('; ');
}

/**
 * @param {object} match
 * @param {object|null|undefined} lead
 * @param {{ technicians?: Array<{ routeId: string|number, stops?: unknown[] }> }} [options]
 * @returns {V2ScoreMetadata}
 */
export function buildMatchV2Score(match, lead, options = {}) {
  const penalties = /** @type {V2ScorePenalty[]} */ ([]);
  const bonuses = /** @type {V2ScoreBonus[]} */ ([]);
  const penaltyConfig = getV2PenaltyConfig();
  const v2Profile = /** @type {V2ProfileMetadata|undefined} */ (match?.v2Profile);
  const profile = matchTechnicianProfile(match?.techName);
  const leadTown = resolveLeadTown(lead);
  const leadRegion = leadTown ? resolveServiceAreaGroupForTown(leadTown) : null;
  const regionRule = getRegionRule(lead?.routeArea);

  const baseTotal = Number(match?.scores?.total ?? 0);

  if (!v2Profile?.matched) {
    penalties.push({
      code: 'missing_technician_profile',
      label: 'Missing technician profile',
      points: penaltyConfig.missingTechnicianProfilePenalty,
    });
  } else {
    bonuses.push({
      code: 'matched_technician_profile',
      label: 'Matched technician profile',
      points: PROFILE_BONUS_POINTS.matchedProfile,
    });
  }

  if (v2Profile?.serviceCapabilityMatch === true) {
    bonuses.push({
      code: 'service_capability_match',
      label: 'Service capability match',
      points: PROFILE_BONUS_POINTS.serviceCapability,
    });
  }

  if (v2Profile?.serviceCapabilityMatch === false) {
    const serviceDisqualified = v2Profile.warnings?.includes('Technician is not eligible for this service');
    penalties.push({
      code: serviceDisqualified ? 'service_not_eligible' : 'service_capability_mismatch',
      label: serviceDisqualified ? 'Service not eligible' : 'Service capability mismatch',
      points: serviceDisqualified ? DISQUALIFYING_PENALTY : penaltyConfig.missingTechnicianProfilePenalty,
    });
  }

  if (v2Profile?.overHardMaxStops) {
    penalties.push({
      code: 'over_hard_max_stops',
      label: 'Over hard max stops',
      points: DISQUALIFYING_PENALTY,
    });
  } else if (v2Profile?.overPreferredMaxStops) {
    penalties.push({
      code: 'over_preferred_max_stops',
      label: 'Over preferred max stops',
      points: penaltyConfig.overPreferredStopPenalty,
    });
  } else if (v2Profile?.matched && v2Profile.preferredMaxStops != null) {
    bonuses.push({
      code: 'under_preferred_max_stops',
      label: 'Under preferred max stops',
      points: PROFILE_BONUS_POINTS.underPreferredMax,
    });
  }

  if (v2Profile?.serviceAreaMatch === false) {
    penalties.push({
      code: 'outside_service_area',
      label: 'Outside service area',
      points: penaltyConfig.outsideServiceAreaPenalty,
    });
  }

  if (profile && leadTown && isLeadInNormalServiceAreas(profile, leadTown)) {
    const areaBonus = leadRegion?.normalServiceAreaBonus ?? regionRule.sameRegionBonus;
    bonuses.push({
      code: 'normal_service_area_match',
      label: 'Job in technician normal service area',
      points: areaBonus,
    });
  }

  const routeLocations = collectRouteStopLocations(match, lead, options.technicians);
  const hasSameTownStop = routeLocations.some(location => townsMatch(location.town, leadTown));
  const hasSameRegionStop = leadRegion
    ? routeLocations.some(location => location.regionKey === leadRegion.key)
    : false;

  if (leadTown && hasSameTownStop) {
    const townBonus = leadRegion?.sameTownBonus ?? regionRule.sameTownBonus;
    bonuses.push({
      code: 'same_town_match',
      label: 'Same town match',
      points: townBonus,
    });
  } else if (leadRegion && hasSameRegionStop) {
    bonuses.push({
      code: 'same_region_match',
      label: 'Same region match',
      points: leadRegion.sameRegionBonus ?? regionRule.sameRegionBonus,
    });
  }

  if (hasSameTownStop) {
    bonuses.push({
      code: 'nearby_route_stop_same_town',
      label: 'Nearby route stop in same town',
      points: PROFILE_BONUS_POINTS.nearbyStopSameTown,
    });
  } else if (hasSameRegionStop) {
    bonuses.push({
      code: 'nearby_route_stop_same_region',
      label: 'Nearby route stop in same region',
      points: PROFILE_BONUS_POINTS.nearbyStopSameRegion,
    });
  }

  if (isStrongGeoCluster(match)) {
    bonuses.push({
      code: 'strong_geo_cluster',
      label: 'Strong geo cluster',
      points: PROFILE_BONUS_POINTS.strongGeoCluster,
    });
  }

  if (isWeakGeoCluster(match)) {
    penalties.push({
      code: 'weak_geo_cluster',
      label: 'Weak or out-of-area geo cluster',
      points: penaltyConfig.weakGeoClusterPenalty,
    });
  }

  if (hasBacktrackingRisk(match)) {
    penalties.push({
      code: 'backtracking_risk',
      label: 'Backtracking risk',
      points: penaltyConfig.backtrackingPenalty,
    });
  }

  const penaltyPoints = penalties.reduce((sum, item) => sum + item.points, 0);
  const bonusPoints = bonuses.reduce((sum, item) => sum + item.points, 0);
  const adjustment = bonusPoints - penaltyPoints;
  const adjustedTotal = baseTotal + adjustment;

  return {
    baseTotal,
    adjustedTotal,
    adjustment,
    penalties,
    bonuses,
    explanation: buildV2ScoreExplanation(penalties, bonuses),
  };
}

/**
 * Sort by eligibility tier, then v2 adjusted score descending.
 * @template T
 * @param {T[]} matches
 * @returns {T[]}
 */
export function reorderMatchesByV2Score(matches) {
  return [...matches].sort((a, b) => {
    const rankA = ELIGIBILITY_RANK[a?.v2Profile?.eligibilityStatus ?? 'eligible'];
    const rankB = ELIGIBILITY_RANK[b?.v2Profile?.eligibilityStatus ?? 'eligible'];
    if (rankA !== rankB) return rankA - rankB;
    return (b?.v2Score?.adjustedTotal ?? 0) - (a?.v2Score?.adjustedTotal ?? 0);
  });
}

/**
 * @param {Array<{ routeId?: string|number, techName?: string, scores?: { total?: number }, v2Score?: V2ScoreMetadata }>} beforeMatches
 * @param {Array<{ routeId?: string|number, techName?: string, scores?: { total?: number }, v2Score?: V2ScoreMetadata }>} afterMatches
 */
export function logV2ScoreRankChanges(beforeMatches, afterMatches) {
  if (!import.meta.env.DEV) return;

  const oldRankByRouteId = new Map(
    beforeMatches.map((match, index) => [String(match.routeId), index + 1]),
  );

  for (let index = 0; index < afterMatches.length; index += 1) {
    const match = afterMatches[index];
    const v2Score = match?.v2Score;
    if (!v2Score) continue;

    console.debug('[RouteFinder V2] score modifier rank', {
      oldRank: oldRankByRouteId.get(String(match.routeId)) ?? null,
      newRank: index + 1,
      techName: match.techName,
      baseTotal: v2Score.baseTotal,
      adjustedTotal: v2Score.adjustedTotal,
      adjustment: v2Score.adjustment,
      penalties: v2Score.penalties,
      bonuses: v2Score.bonuses,
    });
  }
}

/**
 * @param {object|null|undefined} result
 * @param {object|null|undefined} lead
 * @param {Array<{ routeId: string|number, stops?: unknown[] }>|null|undefined} technicians
 * @returns {object|null|undefined}
 */
export function enrichScoringResultWithV2Scores(result, lead, technicians) {
  if (!result || result.noSafeRoute) return result;

  const beforeMatches = result.topMatches ?? [];

  const enrichedTopMatches = beforeMatches.map(match => ({
    ...match,
    v2Score: buildMatchV2Score(match, lead, { technicians }),
  }));

  const reorderedTopMatches = reorderMatchesByV2Score(enrichedTopMatches);
  logV2ScoreRankChanges(beforeMatches, reorderedTopMatches);

  const scoreByRouteId = new Map(
    enrichedTopMatches.map(match => [String(match.routeId), match.v2Score]),
  );

  const allScores = (result.allScores ?? []).map(entry => {
    const existingScore = scoreByRouteId.get(String(entry.routeId));
    if (existingScore) {
      return { ...entry, v2Score: existingScore };
    }

    return {
      ...entry,
      v2Score: buildMatchV2Score(entry, lead, { technicians }),
    };
  });

  return {
    ...result,
    topMatches: reorderedTopMatches,
    recommendation: reorderedTopMatches[0] ?? null,
    alternatives: reorderedTopMatches.slice(1),
    allScores,
  };
}
