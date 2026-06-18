/**
 * Route Finder V2 — dispatcher validation examples for regression testing.
 */

/**
 * @typedef {Object} RouteFinderValidationNewJob
 * @property {string} address
 * @property {number} lat
 * @property {number} lng
 * @property {string} serviceType
 * @property {string} timePreference
 * @property {string} [routeArea]
 * @property {number} [durationMinutes]
 */

/**
 * @typedef {Object} RouteFinderValidationExample
 * @property {string} id
 * @property {string} date - YYYY-MM-DD
 * @property {RouteFinderValidationNewJob} newJob
 * @property {string} expectedTechName
 * @property {number} [acceptedRankMax] - default 1
 * @property {string[]} [acceptableTechNames]
 * @property {string[]} [expectedNotTechNames]
 * @property {string[]} [reasonTags]
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
      routeArea: 'maine',
    },
    expectedTechName: 'Joseph Willey',
    acceptedRankMax: 1,
    acceptableTechNames: ['Joseph Willey'],
    expectedNotTechNames: ['Ian Pratt', 'Paige Bullock'],
    reasonTags: ['same-area', 'kennebunk-cluster', 'lighter-route'],
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

/**
 * @param {string} id
 * @returns {RouteFinderValidationExample|null}
 */
export function getValidationExampleById(id) {
  return ROUTE_FINDER_VALIDATION_EXAMPLES.find(example => example.id === id) ?? null;
}
