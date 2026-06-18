import { describe, it, expect } from 'vitest';
import {
  classifyDispatcherConfidence,
  areNeighboringTechSubstitutionPair,
  isWinnerClearlyOutsideServiceCorridor,
  summarizeDispatcherConfidence,
} from '../dispatcherConfidenceClassification.js';
import { getValidationExamples } from '../validationExamples.js';
import { buildLeadFromValidationExample } from '../validationRunner.js';

function makeFailure(overrides = {}) {
  return {
    id: 'test-failure',
    routeDate: '2026-06-18',
    expectedTechName: 'Joseph Willey',
    actualTopTechName: 'Ian Pratt',
    expectedRank: null,
    failureReason: 'Expected technician not found in top 3',
    dispatcherReason: 'test',
    stopCount: 5,
    overPreferredMax: false,
    overHardMax: false,
    dayMismatchWarnings: [],
    topCandidates: [],
    topMatches: [],
    ...overrides,
  };
}

describe('dispatcherConfidenceClassification', () => {
  it('classifies Kennebunk Ian Pratt miss as high-confidence routing mistake', () => {
    const example = getValidationExamples().find(row => row.id === 'kennebunk-iq-example-002');
    expect(example).toBeTruthy();

    const result = classifyDispatcherConfidence(
      example,
      makeFailure({
        id: example.id,
        expectedTechName: example.expectedTechName,
        actualTopTechName: 'Ian Pratt',
        dispatcherReason: example.dispatcherReason,
      }),
      [
        { techName: 'Joseph Willey', stops: [{ address: '123 Main St, Kennebunk, ME' }] },
        { techName: 'Ian Pratt', stops: [{}, {}, {}, {}, {}] },
      ],
      null,
      ['wrong_region_beating_correct_region'],
    );

    expect(result.dispatcherConfidence).toBe('high');
    expect(result.failureClassification).toBe('true_routing_mistake');
  });

  it('classifies Joseph vs Jack as medium neighboring-tech substitution', () => {
    const example = getValidationExamples().find(row => row.id === 'kennebunk-iq-example-002');
    expect(example).toBeTruthy();

    const result = classifyDispatcherConfidence(
      example,
      makeFailure({
        id: example.id,
        expectedTechName: 'Joseph Willey',
        actualTopTechName: 'Jack Johnson',
        expectedRank: 2,
        dispatcherReason: example.dispatcherReason,
      }),
      [
        { techName: 'Joseph Willey', stops: [{ address: '123 Main St, Kennebunk, ME' }] },
        { techName: 'Jack Johnson', stops: [{ address: '5 Lady Slipper Ln, Kennebunk, ME' }] },
      ],
      null,
      ['other_scoring_miss'],
    );

    expect(result.dispatcherConfidence).toBe('medium');
    expect(result.failureClassification).toBe('acceptable_neighboring_tech_substitution');
    expect(areNeighboringTechSubstitutionPair('Joseph Willey', 'Jack Johnson')).toBe(true);
  });

  it('classifies Lewiston-market Matthew vs Quincy as medium neighboring-tech substitution', () => {
    const example = getValidationExamples().find(row => row.id === 'auburn-iq-example-032');
    expect(example).toBeTruthy();

    const result = classifyDispatcherConfidence(
      example,
      makeFailure({
        id: example.id,
        expectedTechName: 'Matthew Lavigne',
        actualTopTechName: 'Quincy Coachman',
        expectedRank: 2,
        dispatcherReason: example.dispatcherReason,
      }),
      [
        { techName: 'Matthew Lavigne', stops: [{ address: '15 Fitzgerald Ave, Lewiston, ME' }] },
        { techName: 'Quincy Coachman', stops: [{ address: '18 Union St, Sabattus, ME' }] },
      ],
      null,
      ['other_scoring_miss'],
    );

    expect(result.dispatcherConfidence).toBe('medium');
    expect(result.failureClassification).toBe('acceptable_neighboring_tech_substitution');
  });

  it('classifies Durham-corridor Skyler vs Michael as medium neighboring-tech substitution', () => {
    const example = getValidationExamples().find(row => row.id === 'durham-rit-example-041');
    expect(example).toBeTruthy();

    const result = classifyDispatcherConfidence(
      example,
      makeFailure({
        id: example.id,
        expectedTechName: 'Skyler Ruest',
        actualTopTechName: 'Michael Caswell',
        expectedRank: null,
        dispatcherReason: example.dispatcherReason,
      }),
      [
        { techName: 'Skyler Ruest', stops: [{ address: '479 Tuttle Rd, Pownal, ME' }] },
        { techName: 'Michael Caswell', stops: [{ address: '306 Hacker Rd, Brunswick, ME' }] },
      ],
      null,
      ['wrong_region_beating_correct_region'],
    );

    expect(result.dispatcherConfidence).toBe('medium');
    expect(result.failureClassification).toBe('acceptable_neighboring_tech_substitution');
  });

  it('classifies NH outside Jay/Alex as high-confidence routing mistake', () => {
    const example = getValidationExamples().find(row => row.id.includes('portsmouth'));
    expect(example).toBeTruthy();

    const result = classifyDispatcherConfidence(
      example,
      makeFailure({
        id: example.id,
        expectedTechName: example.expectedTechName,
        actualTopTechName: 'Joshua Harrington',
        dispatcherReason: example.dispatcherReason,
      }),
      [{ techName: 'Joshua Harrington', stops: [{}] }],
      null,
      ['wrong_region_beating_correct_region'],
    );

    expect(result.dispatcherConfidence).toBe('high');
    expect(result.failureClassification).toBe('true_routing_mistake');
    expect(result.classificationReason).toMatch(/Jay Glaude \/ Alex Gray/i);
  });

  it('classifies Portland to Rumford tech as high-confidence routing mistake', () => {
    const example = getValidationExamples().find(
      row => row.newJob.address.toLowerCase().includes('portland')
        && row.expectedTechName === 'Paige Bullock',
    );
    expect(example).toBeTruthy();

    const result = classifyDispatcherConfidence(
      example,
      makeFailure({
        id: example.id,
        expectedTechName: example.expectedTechName,
        actualTopTechName: 'Lee Pelletier',
        dispatcherReason: example.dispatcherReason,
      }),
      [{ techName: 'Lee Pelletier', stops: [{}] }],
      null,
      ['wrong_region_beating_correct_region'],
    );

    expect(result.dispatcherConfidence).toBe('high');
    expect(result.failureClassification).toBe('true_routing_mistake');
    expect(result.classificationReason).toMatch(/forbidden|Rumford|western Maine/i);
  });

  it('classifies NH day mismatch on approved tech as low route-day dependent', () => {
    const example = getValidationExamples().find(row => row.id.includes('portsmouth'));
    expect(example).toBeTruthy();

    const result = classifyDispatcherConfidence(
      example,
      makeFailure({
        id: example.id,
        expectedTechName: example.expectedTechName,
        actualTopTechName: 'Alex Gray',
        expectedRank: 2,
        dispatcherReason: example.dispatcherReason,
        dayMismatchWarnings: ['NH route day does not match sub-region schedule'],
      }),
      [{ techName: 'Jay Glaude', stops: [{}] }, { techName: 'Alex Gray', stops: [{}, {}, {}] }],
      null,
      ['nh_day_mismatch'],
    );

    expect(result.dispatcherConfidence).toBe('low');
    expect(result.failureClassification).toBe('route_day_dependent');
  });

  it('classifies expected tech over preferred max as low route-day dependent', () => {
    const example = getValidationExamples()[0];

    const result = classifyDispatcherConfidence(
      example,
      makeFailure({
        id: example.id,
        expectedTechName: example.expectedTechName,
        actualTopTechName: 'Jack Johnson',
        expectedRank: 2,
        dispatcherReason: example.dispatcherReason,
      }),
      [
        {
          techName: 'Joseph Willey',
          stops: Array.from({ length: 14 }, () => ({})),
        },
        { techName: 'Jack Johnson', stops: [{ address: '123 Main St, Kennebunk, ME' }] },
      ],
      null,
      ['expected_tech_over_preferred_max'],
    );

    expect(result.dispatcherConfidence).toBe('low');
    expect(result.failureClassification).toBe('route_day_dependent');
  });

  it('detects winner clearly outside service corridor', () => {
    const example = getValidationExamples()[0];
    const lead = buildLeadFromValidationExample(example);

    expect(isWinnerClearlyOutsideServiceCorridor(lead, 'Lee Pelletier')).toBe(true);
    expect(isWinnerClearlyOutsideServiceCorridor(lead, 'Jack Johnson')).toBe(false);
  });

  it('summarizes confidence counts', () => {
    const summary = summarizeDispatcherConfidence([
      { dispatcherConfidence: 'high', failureClassification: 'true_routing_mistake' },
      { dispatcherConfidence: 'medium', failureClassification: 'acceptable_neighboring_tech_substitution' },
      { dispatcherConfidence: 'low', failureClassification: 'route_day_dependent' },
    ]);

    expect(summary.high).toBe(1);
    expect(summary.medium).toBe(1);
    expect(summary.low).toBe(1);
    expect(summary.byClassification.true_routing_mistake).toBe(1);
  });
});
