import { describe, it, expect } from 'vitest';
import {
  ROUTE_FINDER_VALIDATION_EXAMPLES,
  getValidationExamples,
} from '../validationExamples.js';

describe('validationExamples', () => {
  it('imports the Kennebunk IQ validation example', () => {
    expect(ROUTE_FINDER_VALIDATION_EXAMPLES).toHaveLength(1);
    const example = ROUTE_FINDER_VALIDATION_EXAMPLES[0];
    expect(example).toEqual({
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
    });
  });

  it('getValidationExamples returns a copy', () => {
    const examples = getValidationExamples();
    expect(examples).toEqual(ROUTE_FINDER_VALIDATION_EXAMPLES);
    expect(examples).not.toBe(ROUTE_FINDER_VALIDATION_EXAMPLES);
  });
});
