/**
 * Route Finder V2 — dispatcher confidence classification for real-route failures.
 * Reporting only; does not change scoring weights.
 */

import { matchTechnicianProfile } from './technicianProfiles.js';
import { resolveTownFromAddress } from './profileScoringModifiers.js';
import {
  resolveServiceAreaGroupForTown,
  resolveServiceAreaGroupFromAddress,
  SERVICE_AREA_GROUPS,
} from './regionRules.js';
import { inferRouteAreaFromAddress } from './validationExamples.js';
import {
  isNewHampshireLead,
  isNhApprovedTechnician,
} from './nhRoutingRules.js';
import { profileCoversLeadTown } from './validationCalibrationApplicability.js';
import {
  resolveAcceptableTechNames,
  buildLeadFromValidationExample,
} from './validationRunner.js';

/**
 * @typedef {import('./validationExamples.js').RouteFinderValidationExample} RouteFinderValidationExample
 * @typedef {import('./validationCalibrationDiagnostics.js').RealRouteValidationFailureSummary} RealRouteValidationFailureSummary
 * @typedef {import('./validationFailurePatterns.js').ValidationFailurePatternKey} ValidationFailurePatternKey
 */

/** @typedef {'true_routing_mistake' | 'acceptable_neighboring_tech_substitution' | 'route_day_dependent'} FailureClassification */

/** @typedef {'high' | 'medium' | 'low'} DispatcherConfidence */

/**
 * @typedef {Object} DispatcherConfidenceClassification
 * @property {FailureClassification} failureClassification
 * @property {DispatcherConfidence} dispatcherConfidence
 * @property {string} classificationReason
 */

export const FAILURE_CLASSIFICATION_LABELS = {
  true_routing_mistake: 'True routing mistake',
  acceptable_neighboring_tech_substitution: 'Acceptable neighboring-tech substitution',
  route_day_dependent: 'Route-day dependent',
};

export const DISPATCHER_CONFIDENCE_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** @type {Record<string, Set<string>>} */
const ADJACENT_SERVICE_AREA_KEYS = {
  southern_maine: new Set(['kennebunk_wells_sanford', 'greater_portland']),
  kennebunk_wells_sanford: new Set(['southern_maine', 'greater_portland']),
  greater_portland: new Set(['kennebunk_wells_sanford', 'southern_maine', 'brunswick_midcoast']),
  brunswick_midcoast: new Set(['greater_portland', 'oxford_western']),
  oxford_western: new Set(['brunswick_midcoast']),
  seacoast_nh: new Set(['southern_maine']),
};

/** @type {[string, string][]} */
const NEIGHBORING_TECH_SUBSTITUTION_PAIRS = [
  ['Joseph Willey', 'Jack Johnson'],
  ['Matthew Lavigne', 'Quincy Coachman'],
  ['Skyler Ruest', 'Michael Caswell'],
];

/** @type {string[]} */
const WESTERN_MAINE_CORRIDOR_TECH_NAMES = ['Lee Pelletier', 'Tate Tibbetts'];

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

function techNameInList(techName, names = []) {
  return names.some(name => techNamesEquivalent(techName, name));
}

/**
 * @param {import('./regionRules.js').ServiceAreaGroup|null|undefined} left
 * @param {import('./regionRules.js').ServiceAreaGroup|null|undefined} right
 * @returns {boolean}
 */
function areServiceAreasAdjacent(left, right) {
  if (!left || !right) return false;
  if (left.key === right.key) return true;
  return ADJACENT_SERVICE_AREA_KEYS[left.key]?.has(right.key) ?? false;
}

/**
 * @param {import('./technicianProfiles.js').TechnicianProfile|null|undefined} profile
 * @returns {Set<string>}
 */
function techPrimaryServiceAreaKeys(profile) {
  const keys = new Set();
  if (!profile) return keys;

  for (const town of profile.normalServiceAreas ?? []) {
    const group = resolveServiceAreaGroupForTown(town);
    if (group) keys.add(group.key);
  }

  const homeGroup = resolveServiceAreaGroupForTown(profile.homeBase?.town);
  if (homeGroup) keys.add(homeGroup.key);

  return keys;
}

/**
 * @param {string} expectedTechName
 * @param {string} actualTechName
 * @returns {boolean}
 */
export function areNeighboringTechSubstitutionPair(expectedTechName, actualTechName) {
  return NEIGHBORING_TECH_SUBSTITUTION_PAIRS.some(
    ([left, right]) => (
      (techNamesEquivalent(expectedTechName, left) && techNamesEquivalent(actualTechName, right))
      || (techNamesEquivalent(expectedTechName, right) && techNamesEquivalent(actualTechName, left))
    ),
  );
}

/**
 * @param {object} lead
 * @param {string} winnerTechName
 * @returns {boolean}
 */
export function isWinnerClearlyOutsideServiceCorridor(lead, winnerTechName) {
  const profile = matchTechnicianProfile(winnerTechName);
  if (!profile) return false;

  if (profileCoversLeadTown(profile, lead)) return false;

  const leadGroup = resolveServiceAreaGroupFromAddress(lead.address);
  if (!leadGroup) return false;

  const winnerAreaKeys = techPrimaryServiceAreaKeys(profile);
  if (!winnerAreaKeys.size) return false;

  for (const key of winnerAreaKeys) {
    const winnerGroup = SERVICE_AREA_GROUPS[key];
    if (areServiceAreasAdjacent(leadGroup, winnerGroup)) return false;
  }

  return true;
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {string} actualTopTechName
 * @returns {boolean}
 */
function isAcceptableNeighborWinner(example, actualTopTechName) {
  if (!actualTopTechName) return false;
  const acceptableTechNames = resolveAcceptableTechNames(example);
  if (!techNameInList(actualTopTechName, acceptableTechNames)) return false;
  if (techNamesEquivalent(actualTopTechName, example.expectedTechName)) return false;
  return true;
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {string} winnerTechName
 * @returns {boolean}
 */
function isHighConfidenceRoutingMistake(example, winnerTechName) {
  const lead = buildLeadFromValidationExample(example);
  const forbiddenTechNames = example.expectedNotTechNames ?? [];
  const acceptableTechNames = resolveAcceptableTechNames(example);
  const leadGroup = resolveServiceAreaGroupFromAddress(lead.address);

  if (
    isAcceptableNeighborWinner(example, winnerTechName)
    && areNeighboringTechSubstitutionPair(example.expectedTechName, winnerTechName)
  ) {
    return false;
  }

  if (
    areNeighboringTechSubstitutionPair(example.expectedTechName, winnerTechName)
    && !techNameInList(winnerTechName, forbiddenTechNames)
  ) {
    const winnerProfile = matchTechnicianProfile(winnerTechName);
    if (winnerProfile && leadGroup) {
      if (profileCoversLeadTown(winnerProfile, lead)) return false;
      const winnerAreaKeys = techPrimaryServiceAreaKeys(winnerProfile);
      for (const key of winnerAreaKeys) {
        if (areServiceAreasAdjacent(leadGroup, SERVICE_AREA_GROUPS[key])) return false;
      }
    }
  }

  const nhLead = isNewHampshireLead(lead)
    || inferRouteAreaFromAddress(example.newJob.address) === 'new_hampshire'
    || example.newJob.routeArea === 'new_hampshire';

  if (nhLead && winnerTechName && !isNhApprovedTechnician(winnerTechName)) {
    return true;
  }

  if (techNameInList(winnerTechName, forbiddenTechNames)) {
    return true;
  }

  if (
    leadGroup?.key === 'greater_portland'
    && techNameInList(winnerTechName, WESTERN_MAINE_CORRIDOR_TECH_NAMES)
  ) {
    return true;
  }

  if (
    winnerTechName
    && !techNameInList(winnerTechName, acceptableTechNames)
    && isWinnerClearlyOutsideServiceCorridor(lead, winnerTechName)
  ) {
    return true;
  }

  return false;
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {RealRouteValidationFailureSummary} failure
 * @param {ValidationFailurePatternKey[]} patterns
 * @param {Array<{ techName?: string, stops?: unknown[] }>|null|undefined} technicians
 * @returns {boolean}
 */
function isRouteDayDependentFailure(example, failure, patterns, technicians) {
  const acceptableTechNames = resolveAcceptableTechNames(example);
  const actualTopTechName = failure.actualTopTechName;

  if (patterns.includes('expected_tech_over_preferred_max')) return true;
  if (patterns.includes('expected_tech_over_hard_max')) return true;
  if (patterns.includes('service_capability_issue')) return true;

  if (
    actualTopTechName
    && areNeighboringTechSubstitutionPair(example.expectedTechName, actualTopTechName)
    && !techNameInList(actualTopTechName, example.expectedNotTechNames ?? [])
  ) {
    const lead = buildLeadFromValidationExample(example);
    const leadGroup = resolveServiceAreaGroupFromAddress(lead.address);
    const actualProfile = matchTechnicianProfile(actualTopTechName);
    if (leadGroup && actualProfile) {
      if (profileCoversLeadTown(actualProfile, lead)) return false;
      const winnerAreaKeys = techPrimaryServiceAreaKeys(actualProfile);
      for (const key of winnerAreaKeys) {
        if (areServiceAreasAdjacent(leadGroup, SERVICE_AREA_GROUPS[key])) return false;
      }
    }
  }

  if (
    actualTopTechName
    && isAcceptableNeighborWinner(example, actualTopTechName)
    && areNeighboringTechSubstitutionPair(example.expectedTechName, actualTopTechName)
  ) {
    return false;
  }

  if (
    patterns.includes('nh_day_mismatch')
    && actualTopTechName
    && isNhApprovedTechnician(actualTopTechName)
  ) {
    return true;
  }

  if (
    actualTopTechName
    && techNameInList(actualTopTechName, acceptableTechNames)
    && failure.expectedRank != null
    && failure.expectedRank > 1
  ) {
    return true;
  }

  const lead = buildLeadFromValidationExample(example);
  const leadTown = resolveTownFromAddress(lead.address);
  if (!leadTown || !actualTopTechName) return false;

  const expectedOnRoute = acceptableTechNames.some((name) => {
    const tech = technicians?.find(row => techNamesEquivalent(row?.techName, name));
    return tech != null;
  });

  if (!expectedOnRoute) return false;

  const expectedProfile = matchTechnicianProfile(example.expectedTechName);
  const actualProfile = matchTechnicianProfile(actualTopTechName);
  if (
    expectedProfile
    && actualProfile
    && profileCoversLeadTown(expectedProfile, lead)
    && profileCoversLeadTown(actualProfile, lead)
    && techNameInList(actualTopTechName, acceptableTechNames)
  ) {
    return true;
  }

  return false;
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {RealRouteValidationFailureSummary} failure
 * @returns {boolean}
 */
function isNeighboringTechSubstitution(example, failure) {
  const acceptableTechNames = resolveAcceptableTechNames(example);
  const actualTopTechName = failure.actualTopTechName;
  if (!actualTopTechName) return false;
  if (techNamesEquivalent(actualTopTechName, example.expectedTechName)) return false;

  const forbiddenTechNames = example.expectedNotTechNames ?? [];
  if (techNameInList(actualTopTechName, forbiddenTechNames)) return false;

  const lead = buildLeadFromValidationExample(example);
  const leadGroup = resolveServiceAreaGroupFromAddress(lead.address);
  const actualProfile = matchTechnicianProfile(actualTopTechName);

  const winnerServesLeadCorridor = () => {
    if (!leadGroup || !actualProfile) return false;
    if (profileCoversLeadTown(actualProfile, lead)) return true;
    const winnerAreaKeys = techPrimaryServiceAreaKeys(actualProfile);
    for (const key of winnerAreaKeys) {
      const winnerGroup = SERVICE_AREA_GROUPS[key];
      if (areServiceAreasAdjacent(leadGroup, winnerGroup)) return true;
    }
    return false;
  };

  if (
    areNeighboringTechSubstitutionPair(example.expectedTechName, actualTopTechName)
    && winnerServesLeadCorridor()
  ) {
    return true;
  }

  if (!techNameInList(actualTopTechName, acceptableTechNames)) return false;

  if (!leadGroup || !actualProfile) return false;

  const winnerAreaKeys = techPrimaryServiceAreaKeys(actualProfile);
  for (const key of winnerAreaKeys) {
    const winnerGroup = SERVICE_AREA_GROUPS[key];
    if (areServiceAreasAdjacent(leadGroup, winnerGroup)) return true;
  }

  return false;
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {RealRouteValidationFailureSummary} failure
 * @param {Array<{ techName?: string, stops?: unknown[] }>|null|undefined} [technicians]
 * @param {object|null|undefined} [_scoringResult]
 * @param {ValidationFailurePatternKey[]} [patterns]
 * @returns {DispatcherConfidenceClassification}
 */
export function classifyDispatcherConfidence(
  example,
  failure,
  technicians = [],
  _scoringResult = null,
  patterns = [],
) {
  const actualTopTechName = failure.actualTopTechName;

  if (actualTopTechName && isHighConfidenceRoutingMistake(example, actualTopTechName)) {
    if (
      isNewHampshireLead(buildLeadFromValidationExample(example))
      && !isNhApprovedTechnician(actualTopTechName)
    ) {
      return {
        failureClassification: 'true_routing_mistake',
        dispatcherConfidence: 'high',
        classificationReason: 'NH job assigned outside Jay Glaude / Alex Gray corridor',
      };
    }

    if (techNameInList(actualTopTechName, example.expectedNotTechNames ?? [])) {
      return {
        failureClassification: 'true_routing_mistake',
        dispatcherConfidence: 'high',
        classificationReason: 'Winning technician is explicitly forbidden for this lead',
      };
    }

    const leadGroup = resolveServiceAreaGroupFromAddress(example.newJob.address);
    if (
      leadGroup?.key === 'greater_portland'
      && techNameInList(actualTopTechName, WESTERN_MAINE_CORRIDOR_TECH_NAMES)
    ) {
      return {
        failureClassification: 'true_routing_mistake',
        dispatcherConfidence: 'high',
        classificationReason: 'Greater Portland job assigned to western Maine / Rumford corridor tech',
      };
    }

    return {
      failureClassification: 'true_routing_mistake',
      dispatcherConfidence: 'high',
      classificationReason: 'Winning technician is clearly outside the expected service corridor',
    };
  }

  if (isRouteDayDependentFailure(example, failure, patterns, technicians)) {
    if (patterns.includes('nh_day_mismatch')) {
      return {
        failureClassification: 'route_day_dependent',
        dispatcherConfidence: 'low',
        classificationReason: 'NH sub-region day schedule can flip the preferred technician',
      };
    }

    if (
      patterns.includes('expected_tech_over_preferred_max')
      || patterns.includes('expected_tech_over_hard_max')
    ) {
      return {
        failureClassification: 'route_day_dependent',
        dispatcherConfidence: 'low',
        classificationReason: 'Expected technician route load may justify choosing an alternate acceptable tech',
      };
    }

    return {
      failureClassification: 'route_day_dependent',
      dispatcherConfidence: 'low',
      classificationReason: 'Either acceptable technician could be correct depending on stops already assigned',
    };
  }

  if (isNeighboringTechSubstitution(example, failure)) {
    const pairLabel = areNeighboringTechSubstitutionPair(
      example.expectedTechName,
      actualTopTechName,
    )
      ? `${example.expectedTechName} vs ${actualTopTechName}`
      : 'adjacent territory technicians';

    return {
      failureClassification: 'acceptable_neighboring_tech_substitution',
      dispatcherConfidence: 'medium',
      classificationReason: `Dispatcher might reasonably choose either technician (${pairLabel})`,
    };
  }

  if (
    actualTopTechName
    && !techNameInList(actualTopTechName, resolveAcceptableTechNames(example))
  ) {
    return {
      failureClassification: 'true_routing_mistake',
      dispatcherConfidence: 'high',
      classificationReason: 'Winning technician is outside acceptable dispatcher choices',
    };
  }

  return {
    failureClassification: 'route_day_dependent',
    dispatcherConfidence: 'low',
    classificationReason: 'Failure may depend on same-day route composition',
  };
}

/**
 * @param {Array<RealRouteValidationFailureSummary & {
 *   failureClassification?: FailureClassification,
 *   dispatcherConfidence?: DispatcherConfidence,
 * }>} failures
 * @returns {{ high: number, medium: number, low: number, byClassification: Record<FailureClassification, number> }}
 */
export function summarizeDispatcherConfidence(failures = []) {
  const byConfidence = { high: 0, medium: 0, low: 0 };
  const byClassification = {
    true_routing_mistake: 0,
    acceptable_neighboring_tech_substitution: 0,
    route_day_dependent: 0,
  };

  for (const failure of failures) {
    const confidence = failure.dispatcherConfidence;
    const classification = failure.failureClassification;
    if (confidence && byConfidence[confidence] != null) {
      byConfidence[confidence] += 1;
    }
    if (classification && byClassification[classification] != null) {
      byClassification[classification] += 1;
    }
  }

  return {
    ...byConfidence,
    byClassification,
  };
}
