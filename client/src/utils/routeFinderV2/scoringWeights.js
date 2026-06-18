/**
 * Route Finder V2 — scoring weights and penalties.
 * Not applied by live scoring yet.
 */

/** @typedef {import('./scoringWeights.js').V2ScoringWeights} V2ScoringWeights */
/** @typedef {import('./scoringWeights.js').V2PenaltyConfig} V2PenaltyConfig */

/**
 * @typedef {Object} V2ScoringWeights
 * @property {number} driveImpact
 * @property {number} timeWindowFit
 * @property {number} workloadFit
 * @property {number} geoClusterFit
 * @property {number} technicianProfileFit
 * @property {number} routeDamage
 */

/**
 * @typedef {Object} V2PenaltyConfig
 * @property {number} overPreferredStopPenalty
 * @property {boolean} overHardStopDisqualify
 * @property {number} outsideServiceAreaPenalty
 * @property {number} backtrackingPenalty
 * @property {number} weakGeoClusterPenalty
 * @property {number} missingTechnicianProfilePenalty
 * @property {number} missingCoordinatesPenalty
 */

/** @type {V2ScoringWeights} */
export const V2_SCORING_WEIGHTS = {
  driveImpact: 0.30,
  timeWindowFit: 0.20,
  workloadFit: 0.20,
  geoClusterFit: 0.15,
  technicianProfileFit: 0.10,
  routeDamage: 0.05,
};

/** @type {V2PenaltyConfig} */
export const V2_PENALTY_CONFIG = {
  overPreferredStopPenalty: 8,
  overHardStopDisqualify: true,
  outsideServiceAreaPenalty: 12,
  backtrackingPenalty: 10,
  weakGeoClusterPenalty: 8,
  missingTechnicianProfilePenalty: 15,
  missingCoordinatesPenalty: 100,
};

/**
 * @returns {V2ScoringWeights}
 */
export function getV2ScoringWeights() {
  return { ...V2_SCORING_WEIGHTS };
}

/**
 * @returns {V2PenaltyConfig}
 */
export function getV2PenaltyConfig() {
  return { ...V2_PENALTY_CONFIG };
}

/**
 * @returns {number}
 */
export function sumV2ScoringWeights(weights = V2_SCORING_WEIGHTS) {
  return Object.values(weights).reduce((sum, value) => sum + value, 0);
}
