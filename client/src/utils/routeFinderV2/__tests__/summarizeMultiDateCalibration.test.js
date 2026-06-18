import { describe, it, expect } from 'vitest';
import {
  extractClassifiedFailuresFromReport,
  findRepeatedHighConfidenceMistakes,
  summarizeMultiDateCalibration,
} from '../summarizeMultiDateCalibration.js';

describe('summarizeMultiDateCalibration', () => {
  it('groups failures by dispatcher confidence and recommends dataset updates for medium/low', () => {
    const makeReport = (routeDate, failures) => ({
      routeDate,
      fixturePassRate: 1,
      realRoutePassRate: 0.5,
      realRouteApplicableCount: 2,
      realRouteSkippedCount: 0,
      realRouteFailures: failures,
      patternReport: {
        patternsByExampleId: {},
      },
    });

    const reports = [
      makeReport('2026-06-04', [{
        id: 'kennebunk-iq-example-002',
        routeDate: '2026-06-04',
        expectedTechName: 'Joseph Willey',
        actualTopTechName: 'Ian Pratt',
        expectedRank: null,
        failureClassification: 'true_routing_mistake',
        dispatcherConfidence: 'high',
        classificationReason: 'Outside corridor',
        dispatcherReason: 'Joseph should win',
      }]),
      makeReport('2026-06-05', [{
        id: 'kennebunk-iq-example-002',
        routeDate: '2026-06-05',
        expectedTechName: 'Joseph Willey',
        actualTopTechName: 'Ian Pratt',
        expectedRank: null,
        failureClassification: 'true_routing_mistake',
        dispatcherConfidence: 'high',
        classificationReason: 'Outside corridor',
        dispatcherReason: 'Joseph should win',
      }, {
        id: 'kennebunk-rit-example-003',
        routeDate: '2026-06-05',
        expectedTechName: 'Jack Johnson',
        actualTopTechName: 'Joseph Willey',
        expectedRank: 2,
        failureClassification: 'acceptable_neighboring_tech_substitution',
        dispatcherConfidence: 'medium',
        classificationReason: 'Joseph vs Jack',
        dispatcherReason: 'Either Kennebunk tech is fine',
      }]),
    ];

    const summary = summarizeMultiDateCalibration(reports);

    expect(summary.byConfidence.high).toHaveLength(2);
    expect(summary.byConfidence.medium).toHaveLength(1);
    expect(summary.repeatedHighConfidenceMistakes).toHaveLength(1);
    expect(summary.recommendations.scoringChanges.join('\n')).toContain('kennebunk-iq-example-002');
    expect(summary.recommendations.validationDatasetUpdates.join('\n')).toContain('kennebunk-rit-example-003');
    expect(summary.reportText).toContain('Multi-Date Calibration Summary');
  });

  it('extracts classified failures from calibration report', () => {
    const rows = extractClassifiedFailuresFromReport({
      routeDate: '2026-06-04',
      realRouteFailures: [{
        id: 'a',
        routeDate: '2026-06-04',
        expectedTechName: 'A',
        actualTopTechName: 'B',
        dispatcherConfidence: 'high',
        failureClassification: 'true_routing_mistake',
      }],
      patternReport: { patternsByExampleId: { a: ['wrong_region_beating_correct_region'] } },
    });

    expect(rows[0].patterns).toEqual(['wrong_region_beating_correct_region']);
    expect(findRepeatedHighConfidenceMistakes(rows)).toHaveLength(0);
  });
});
