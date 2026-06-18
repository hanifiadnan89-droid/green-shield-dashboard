/**
 * Route Finder V2 — dispatcher validation examples for regression testing.
 */

import { ADDITIONAL_VALIDATION_EXAMPLES } from './validationExamplesData.js';

/** @typedef {'RIT'|'IQ'|'TICK_MOSQUITO'|'BED_BUG'|'COMMERCIAL'|'RESERVICE'|'FOLLOW_UP'|'GENERAL'} ValidationServiceType */

/** @typedef {'Anytime'|'AM'|'PM'|'8-10'|'10-12'|'12-2'|'2-4'|'4-6'|'8-12'|'12-4'} ValidationTimePreference */

/**
 * @typedef {Object} RouteFinderValidationNewJob
 * @property {string} address
 * @property {number} lat
 * @property {number} lng
 * @property {ValidationServiceType} serviceType
 * @property {ValidationTimePreference} timePreference
 * @property {string} [routeArea]
 * @property {number} [durationMinutes]
 * @property {boolean} [customerMustBeHome]
 * @property {boolean} [sameDayUrgent]
 * @property {boolean} [exteriorOnly]
 * @property {boolean} [isPaidInitial]
 * @property {boolean} [isReservice]
 * @property {boolean} [isCommercial]
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

/** @type {ValidationServiceType[]} */
export const VALIDATION_SERVICE_TYPES = [
  'RIT',
  'IQ',
  'TICK_MOSQUITO',
  'BED_BUG',
  'COMMERCIAL',
  'RESERVICE',
  'FOLLOW_UP',
  'GENERAL',
];

const KENNEBUNK_IQ_EXAMPLE_001 = {
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
};

/** @type {RouteFinderValidationExample[]} */
export const ROUTE_FINDER_VALIDATION_EXAMPLES = [
  KENNEBUNK_IQ_EXAMPLE_001,
  ...ADDITIONAL_VALIDATION_EXAMPLES,
];

/**
 * @param {string|null|undefined} serviceType
 * @returns {boolean}
 */
export function isValidValidationServiceType(serviceType) {
  return VALIDATION_SERVICE_TYPES.includes(serviceType);
}

/**
 * @param {RouteFinderValidationExample} example
 * @returns {number}
 */
export function resolveAcceptedRankMax(example) {
  return example.acceptedRankMax ?? 1;
}

/**
 * @param {string|null|undefined} address
 * @returns {'maine'|'new_hampshire'}
 */
export function inferRouteAreaFromAddress(address) {
  const upper = String(address ?? '').toUpperCase();
  if (upper.includes(', NH') || upper.includes('NEW HAMPSHIRE')) {
    return 'new_hampshire';
  }
  return 'maine';
}

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

/**
 * @returns {number}
 */
export function getValidationExampleCount() {
  return ROUTE_FINDER_VALIDATION_EXAMPLES.length;
}
