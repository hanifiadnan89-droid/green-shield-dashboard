/**
 * Route Finder V2 — technician profile matching and eligibility metadata.
 * Enriches scored matches without replacing the legacy scorer.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';
import { resolveLeadServiceTypeKey } from './serviceDurations.js';
import { getRegionRule } from './regionRules.js';
import { getV2PenaltyConfig } from './scoringWeights.js';

/** @typedef {'eligible' | 'warning' | 'disqualified'} V2EligibilityStatus */

/**
 * @typedef {Object} V2ProfileMetadata
 * @property {boolean} matched
 * @property {string|null} profileTechName
 * @property {number|null} preferredMaxStops
 * @property {number|null} hardMaxStops
 * @property {boolean|null} serviceAreaMatch
 * @property {boolean|null} serviceCapabilityMatch
 * @property {boolean} overPreferredMaxStops
 * @property {boolean} overHardMaxStops
 * @property {number} profileFitScore
 * @property {V2EligibilityStatus} eligibilityStatus
 * @property {string[]} warnings
 */

const ELIGIBILITY_RANK = {
  eligible: 0,
  warning: 1,
  disqualified: 2,
};

const PROFILE_FIT_BASE = 100;

function normalizeRouteArea(routeArea) {
  const key = String(routeArea ?? 'general').trim().toLowerCase();
  if (key === 'nh') return 'new_hampshire';
  return key;
}

/**
 * @param {import('./technicianProfiles.js').TechnicianProfile} profile
 * @param {object|null|undefined} lead
 * @returns {boolean|null}
 */
export function evaluateServiceAreaMatch(profile, lead) {
  const areas = profile?.normalServiceAreas ?? [];
  if (!areas.length) return null;

  const routeArea = normalizeRouteArea(lead?.routeArea);
  if (routeArea === 'general') return true;

  const haystack = areas.join(' ').toLowerCase();
  if (routeArea === 'maine') {
    return haystack.includes('maine') || /\bme\b/.test(haystack);
  }
  if (routeArea === 'new_hampshire') {
    return haystack.includes('hampshire') || /\bnh\b/.test(haystack);
  }

  const regionRule = getRegionRule(routeArea);
  return regionRule.matchTerms.some(term => haystack.includes(term.trim()));
}

/**
 * @param {object} match
 * @param {Array<{ routeId: string|number, stops?: unknown[] }>|null|undefined} technicians
 * @returns {number}
 */
export function resolveProjectedStopCount(match, technicians) {
  if (Number.isFinite(match?.stopCount)) {
    return match.stopCount + 1;
  }

  const tech = technicians?.find(t => String(t.routeId) === String(match?.routeId));
  const currentStops = tech?.stops?.length ?? 0;
  return currentStops + 1;
}

/**
 * @param {object} match
 * @param {object|null|undefined} lead
 * @param {{ technicians?: Array<{ routeId: string|number, stops?: unknown[] }> }} [options]
 * @returns {V2ProfileMetadata}
 */
export function buildMatchV2Profile(match, lead, options = {}) {
  const penalties = getV2PenaltyConfig();
  const profile = matchTechnicianProfile(match?.techName);
  const serviceTypeKey = resolveLeadServiceTypeKey(lead);
  const projectedStopCount = resolveProjectedStopCount(match, options.technicians);
  const warnings = [];

  if (!profile) {
    return {
      matched: false,
      profileTechName: null,
      preferredMaxStops: null,
      hardMaxStops: null,
      serviceAreaMatch: null,
      serviceCapabilityMatch: null,
      overPreferredMaxStops: false,
      overHardMaxStops: false,
      profileFitScore: Math.max(0, PROFILE_FIT_BASE - penalties.missingTechnicianProfilePenalty),
      eligibilityStatus: 'warning',
      warnings: ['Missing technician profile'],
    };
  }

  let eligibilityStatus = /** @type {V2EligibilityStatus} */ ('eligible');
  let profileFitScore = PROFILE_FIT_BASE;

  const preferredMaxStops = profile.preferredMaxStops;
  const hardMaxStops = profile.hardMaxStops;
  const overPreferredMaxStops = projectedStopCount > preferredMaxStops;
  const overHardMaxStops = projectedStopCount > hardMaxStops;

  const inCannotDo = profile.cannotDoServices.includes(serviceTypeKey);
  const inCanDo = profile.canDoServices.includes(serviceTypeKey);
  let serviceCapabilityMatch = null;

  if (inCannotDo) {
    serviceCapabilityMatch = false;
    eligibilityStatus = 'disqualified';
    warnings.push('Technician is not eligible for this service');
  } else if (inCanDo) {
    serviceCapabilityMatch = true;
  } else if (serviceTypeKey === 'GENERAL') {
    serviceCapabilityMatch = true;
  } else {
    serviceCapabilityMatch = false;
    if (eligibilityStatus !== 'disqualified') eligibilityStatus = 'warning';
    warnings.push('Service not in technician capability list');
  }

  if (overHardMaxStops) {
    eligibilityStatus = 'disqualified';
    warnings.push('Route exceeds hard stop limit');
  } else if (overPreferredMaxStops) {
    profileFitScore -= penalties.overPreferredStopPenalty;
    if (eligibilityStatus !== 'disqualified') eligibilityStatus = 'warning';
    warnings.push('Route exceeds preferred stop limit');
  }

  const serviceAreaMatch = evaluateServiceAreaMatch(profile, lead);
  if (serviceAreaMatch === false) {
    profileFitScore -= penalties.outsideServiceAreaPenalty;
    if (eligibilityStatus === 'eligible') eligibilityStatus = 'warning';
  }

  if (eligibilityStatus === 'disqualified') {
    profileFitScore = 0;
  } else {
    profileFitScore = Math.max(0, Math.min(PROFILE_FIT_BASE, profileFitScore));
  }

  return {
    matched: true,
    profileTechName: profile.techName,
    preferredMaxStops,
    hardMaxStops,
    serviceAreaMatch,
    serviceCapabilityMatch,
    overPreferredMaxStops,
    overHardMaxStops,
    profileFitScore,
    eligibilityStatus,
    warnings,
  };
}

/**
 * Move disqualified matches below eligible/warning candidates while preserving score order within tiers.
 * @template T
 * @param {T[]} matches
 * @returns {T[]}
 */
export function reorderMatchesByEligibility(matches) {
  return [...matches].sort((a, b) => {
    const rankA = ELIGIBILITY_RANK[a?.v2Profile?.eligibilityStatus ?? 'eligible'];
    const rankB = ELIGIBILITY_RANK[b?.v2Profile?.eligibilityStatus ?? 'eligible'];
    if (rankA !== rankB) return rankA - rankB;
    return (b?.scores?.total ?? 0) - (a?.scores?.total ?? 0);
  });
}

/**
 * @param {Array<{ v2Profile?: V2ProfileMetadata }>} matches
 */
export function summarizeV2ProfileStats(matches) {
  let profilesFound = 0;
  let missingProfiles = 0;
  let warningCandidates = 0;
  let disqualifiedCandidates = 0;

  for (const match of matches) {
    const profile = match?.v2Profile;
    if (!profile) continue;
    if (profile.matched) profilesFound += 1;
    else missingProfiles += 1;
    if (profile.eligibilityStatus === 'warning') warningCandidates += 1;
    if (profile.eligibilityStatus === 'disqualified') disqualifiedCandidates += 1;
  }

  return {
    profilesFound,
    missingProfiles,
    warningCandidates,
    disqualifiedCandidates,
  };
}

/**
 * @param {object|null|undefined} result
 * @param {object|null|undefined} lead
 * @param {Array<{ routeId: string|number, stops?: unknown[] }>|null|undefined} technicians
 * @returns {object|null|undefined}
 */
export function enrichScoringResultWithV2Profiles(result, lead, technicians) {
  if (!result || result.noSafeRoute) return result;

  const enrichedTopMatches = (result.topMatches ?? []).map(match => ({
    ...match,
    v2Profile: buildMatchV2Profile(match, lead, { technicians }),
  }));

  const reorderedTopMatches = reorderMatchesByEligibility(enrichedTopMatches);

  const profileByRouteId = new Map(
    enrichedTopMatches.map(match => [String(match.routeId), match.v2Profile]),
  );

  const allScores = (result.allScores ?? []).map(entry => {
    const existingProfile = profileByRouteId.get(String(entry.routeId));
    if (existingProfile) {
      return { ...entry, v2Profile: existingProfile };
    }

    return {
      ...entry,
      v2Profile: buildMatchV2Profile(entry, lead, { technicians }),
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
