import { describe, it, expect } from 'vitest';
import {
  ROUTE_FINDER_VALIDATION_EXAMPLES,
  VALIDATION_SERVICE_TYPES,
  getValidationExamples,
  getValidationExampleById,
  getValidationExampleCount,
  isValidValidationServiceType,
  resolveAcceptedRankMax,
} from '../validationExamples.js';

describe('validationExamples dataset', () => {
  it('imports successfully with the anchor Kennebunk example and expanded dataset', () => {
    expect(ROUTE_FINDER_VALIDATION_EXAMPLES.length).toBeGreaterThanOrEqual(54);
    expect(ROUTE_FINDER_VALIDATION_EXAMPLES[0].id).toBe('kennebunk-iq-example-001');
    expect(getValidationExampleById('old-orchard-bedbug-example-051')).toBeTruthy();
  });

  it('every validation example has a unique id', () => {
    const ids = ROUTE_FINDER_VALIDATION_EXAMPLES.map(example => example.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every validation example has expectedTechName', () => {
    for (const example of ROUTE_FINDER_VALIDATION_EXAMPLES) {
      expect(typeof example.expectedTechName).toBe('string');
      expect(example.expectedTechName.trim().length).toBeGreaterThan(0);
    }
  });

  it('every validation example has a valid serviceType', () => {
    for (const example of ROUTE_FINDER_VALIDATION_EXAMPLES) {
      expect(isValidValidationServiceType(example.newJob.serviceType)).toBe(true);
      expect(VALIDATION_SERVICE_TYPES).toContain(example.newJob.serviceType);
    }
  });

  it('acceptedRankMax defaults to 1 when missing', () => {
    expect(resolveAcceptedRankMax({
      id: 'test',
      date: '2026-06-18',
      newJob: {
        address: '1 Main, Kennebunk, ME',
        lat: 1,
        lng: 1,
        serviceType: 'IQ',
        timePreference: 'Anytime',
      },
      expectedTechName: 'Joseph Willey',
      dispatcherReason: 'reason',
      notes: 'notes',
    })).toBe(1);

    expect(resolveAcceptedRankMax(ROUTE_FINDER_VALIDATION_EXAMPLES.find(
      e => e.id === 'kennebunk-rit-example-003',
    ))).toBe(2);
  });

  it('getValidationExamples returns a copy', () => {
    const examples = getValidationExamples();
    expect(examples).toEqual(ROUTE_FINDER_VALIDATION_EXAMPLES);
    expect(examples).not.toBe(ROUTE_FINDER_VALIDATION_EXAMPLES);
  });

  it('getValidationExampleCount matches dataset length', () => {
    expect(getValidationExampleCount()).toBe(ROUTE_FINDER_VALIDATION_EXAMPLES.length);
  });

  it('getValidationExampleById returns neighboring-tech acceptableTechNames for calibration examples', () => {
    expect(getValidationExampleById('kennebunk-iq-example-001')).toMatchObject({
      acceptableTechNames: ['Joseph Willey', 'Jack Johnson'],
      acceptedRankMax: 2,
    });
    expect(getValidationExampleById('lewiston-general-example-033')).toMatchObject({
      acceptableTechNames: ['Matthew Lavigne', 'Quincy Coachman'],
      acceptedRankMax: 2,
    });
    expect(getValidationExampleById('durham-rit-example-041')).toMatchObject({
      acceptableTechNames: ['Skyler Ruest', 'Michael Caswell'],
      acceptedRankMax: 2,
    });
  });
});
