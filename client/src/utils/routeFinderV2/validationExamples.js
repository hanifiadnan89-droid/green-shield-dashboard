/**
 * Route Finder V2 — dispatcher validation examples for regression testing.
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

/** @type {RouteFinderValidationExample[]} */
export const ROUTE_FINDER_VALIDATION_EXAMPLES = [
  {
    id: 'kennebunk-iq-example-001',
    date: '2026-06-17',
    newJob: {
      address: '123 Main St, Kennebunk, ME',
      lat: 43.3845,
      lng: -70.5448,
      serviceType: 'IQ',
      timePreference: 'Anytime',
    },
    expectedTechName: 'Joseph Willey',
    dispatcherReason: 'Already had nearby Kennebunk stops and route was lighter.',
    notes: 'Avoid Portland tech unless no Kennebunk-area route is available.',
  },
];

/**
 * @returns {RouteFinderValidationExample[]}
 */
export function getValidationExamples() {
  return [...ROUTE_FINDER_VALIDATION_EXAMPLES];
}
