/**
 * Route Finder V2 — dispatcher validation examples for regression testing.
 * Empty for now; populate with real dispatcher scenarios in a later pass.
 */

/**
 * @typedef {Object} RouteFinderValidationExample
 * @property {string} id
 * @property {string} date - YYYY-MM-DD
 * @property {{ address: string, lat: number, lng: number, serviceType: string, timePreference: string }} newJob
 * @property {string} expectedTechName
 * @property {string} dispatcherReason
 * @property {string} notes
 */

/**
 * Documented example shape (not active data):
 * {
 *   id: 'example-saco-rit-am',
 *   date: '2026-06-10',
 *   newJob: {
 *     address: '123 Greenway Drive, Saco, ME 04072',
 *     lat: 43.500,
 *     lng: -70.442,
 *     serviceType: 'RIT',
 *     timePreference: 'AM',
 *   },
 *   expectedTechName: 'Chris Adams',
 *   dispatcherReason: 'Closest coastal cluster with AM capacity.',
 *   notes: 'EXAMPLE ONLY — add real dispatcher cases here for V2 regression.',
 * }
 */

/** @type {RouteFinderValidationExample[]} */
export const ROUTE_FINDER_VALIDATION_EXAMPLES = [];

/**
 * @returns {RouteFinderValidationExample[]}
 */
export function getValidationExamples() {
  return [...ROUTE_FINDER_VALIDATION_EXAMPLES];
}
