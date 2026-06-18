import { describe, it, expect } from 'vitest';
import {
  VALIDATION_FAILURE_PATTERN_LABELS,
  buildValidationFailurePatternReport,
  classifyRealRouteFailurePatterns,
  formatValidationFailurePatternReport,
  scoreFailurePriority,
} from '../validationFailurePatterns.js';
import { getValidationExamples } from '../validationExamples.js';

describe('validationFailurePatterns', () => {
  it('classifies wrong region beating correct region for applicable failures', () => {
    const example = getValidationExamples()[0];
    const patterns = classifyRealRouteFailurePatterns(
      example,
      {
        id: example.id,
        routeDate: '2026-06-18',
        expectedTechName: example.expectedTechName,
        actualTopTechName: 'Ian Pratt',
        expectedRank: null,
        failureReason: 'Expected technician not found in top 3: Joseph Willey',
        dispatcherReason: example.dispatcherReason,
        stopCount: 5,
        overPreferredMax: false,
        overHardMax: false,
        dayMismatchWarnings: [],
        topCandidates: [],
        topMatches: [],
      },
      [
        { techName: 'Joseph Willey', stops: [{ address: '120 Main St, Kennebunk, ME' }] },
        { techName: 'Ian Pratt', stops: [{}, {}, {}, {}, {}] },
      ],
      { topMatches: [{ techName: 'Ian Pratt', v2Profile: { warnings: [] } }] },
    );

    expect(patterns).toContain('wrong_region_beating_correct_region');
    expect(patterns).not.toContain('expected_tech_route_not_present');
  });

  it('classifies NH day mismatch warnings', () => {
    const nhExample = getValidationExamples().find(example => example.id.includes('portsmouth'));
    expect(nhExample).toBeTruthy();

    const patterns = classifyRealRouteFailurePatterns(
      nhExample,
      {
        id: nhExample.id,
        routeDate: '2026-06-18',
        expectedTechName: nhExample.expectedTechName,
        actualTopTechName: 'Alex Gray',
        expectedRank: 2,
        failureReason: 'Expected technician ranked #2, but acceptedRankMax is 1',
        dispatcherReason: nhExample.dispatcherReason,
        stopCount: 4,
        overPreferredMax: false,
        overHardMax: false,
        dayMismatchWarnings: ['NH route day does not match sub-region schedule'],
        topCandidates: [],
        topMatches: [],
      },
      [{ techName: 'Jay Glaude', stops: [{}] }, { techName: 'Alex Gray', stops: [{}, {}, {}] }],
      { topMatches: [] },
    );

    expect(patterns).toContain('nh_day_mismatch');
  });

  it('builds grouped pattern report and top 10 priority list for applicable failures only', () => {
    const examples = getValidationExamples().slice(0, 2);
    const report = buildValidationFailurePatternReport({
      examples,
      results: [
        {
          id: examples[0].id,
          applicable: true,
          passed: false,
          expectedTechName: examples[0].expectedTechName,
          actualTopTechName: 'Ian Pratt',
          expectedRank: null,
          acceptedRankMax: 1,
          topMatches: [],
          failureReason: 'Expected technician not found in top 3',
          dispatcherReason: examples[0].dispatcherReason,
          notes: '',
          technicianCount: 2,
          routeDate: '2026-06-18',
          routeTechnicianCount: 2,
          topTechStopCount: 5,
          topTechOverPreferredMax: false,
          topTechOverHardMax: false,
          dayMismatchWarnings: [],
          topCandidates: [],
        },
      ],
      techniciansByExampleId: {
        [examples[0].id]: [
          { techName: 'Joseph Willey', stops: [{ address: '120 Main St, Kennebunk, ME' }] },
          { techName: 'Ian Pratt', stops: [{}, {}, {}, {}, {}] },
        ],
      },
      scoringByExampleId: {
        [examples[0].id]: { topMatches: [{ techName: 'Ian Pratt', v2Profile: { warnings: [] } }] },
      },
    });

    expect(report.groups.length).toBeGreaterThan(0);
    expect(report.prioritizedFailures[0].priorityScore).toBe(scoreFailurePriority(
      report.prioritizedFailures[0].patterns,
      report.prioritizedFailures[0],
    ));

    expect(report.prioritizedFailures[0].dispatcherConfidence).toBe('high');
    expect(report.prioritizedFailures[0].failureClassification).toBe('true_routing_mistake');
    expect(report.confidenceSummary.high).toBe(1);

    const text = formatValidationFailurePatternReport(report, {
      routeDate: '2026-06-18',
      fixturePassRate: 1,
      realRoutePassRate: 0,
      realRouteApplicableCount: 1,
      realRouteSkippedCount: 1,
      totalRealRouteFailures: 1,
    });

    expect(text).toContain(VALIDATION_FAILURE_PATTERN_LABELS.wrong_region_beating_correct_region);
    expect(text).toContain('Dispatcher confidence summary');
    expect(text).toContain('Top 10 highest-priority failures');
  });
});
