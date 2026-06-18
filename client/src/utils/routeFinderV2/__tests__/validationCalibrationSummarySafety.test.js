import { describe, it, expect } from 'vitest';
import {
  applyComparisonDiagnosticFailureFilterToReport,
  applyPrintedComparisonsToCalibrationReports,
  finalizeCalibrationReportForMultiDateOutput,
  hasCorridorOwnerNotScheduledComparisonDiagnostics,
  isTerritoryDiagnosticNotScheduled,
  prepareCalibrationReportsForMultiDateSummary,
  reclassifyRealRouteResultAsCorridorOwnerNotScheduled,
  shouldReclassifyFailureFromComparisonDiagnostics,
} from '../validationCalibrationSummarySafety.js';
import { comparisonDiagnosticsIndicateCorridorOwnerNotScheduled } from '../validationFailureScoreComparison.js';
import { summarizeMultiDateCalibration } from '../summarizeMultiDateCalibration.js';
import { getValidationExampleById } from '../validationExamples.js';

describe('validationCalibrationSummarySafety', () => {
  it('detects corridor-owner-not-scheduled comparison diagnostics', () => {
    const expectedTerritory = {
      scheduled: false,
      unavailabilityReasons: ['not_scheduled'],
    };
    const winnerTerritory = {
      scheduled: false,
      unavailabilityReasons: ['not_scheduled'],
    };

    expect(isTerritoryDiagnosticNotScheduled(expectedTerritory)).toBe(true);
    expect(hasCorridorOwnerNotScheduledComparisonDiagnostics(
      expectedTerritory,
      winnerTerritory,
    )).toBe(true);
  });

  it('does not reclassify when either technician is scheduled on the route cache', () => {
    expect(hasCorridorOwnerNotScheduledComparisonDiagnostics(
      { scheduled: false, unavailabilityReasons: ['not_scheduled'] },
      { scheduled: true, unavailabilityReasons: [] },
    )).toBe(false);
  });

  it('reclassifies applicable failures when comparison diagnostics match', () => {
    const windhamExample = getValidationExampleById('windham-general-example-024');
    const technicians = [
      {
        techName: 'Paige Bullock',
        routeId: 'R-2026-06-04-PB',
        stops: [{ address: '100 Main St, Westbrook, ME' }],
      },
      {
        techName: 'Ian Pratt',
        routeId: 'R-2026-06-04-IP',
        stops: [{ address: '220 US Route 1, Scarborough, ME' }],
      },
    ];
    const result = {
      id: windhamExample.id,
      passed: false,
      applicable: true,
      expectedTechName: 'Chris McGary',
      actualTopTechName: 'Skyler Ruest',
      expectedRank: null,
      acceptedRankMax: 2,
      topMatches: [],
      failureReason: 'Expected technician not found in top 3: Chris McGary, Paige Bullock',
      dispatcherReason: windhamExample.dispatcherReason,
      notes: '',
      technicianCount: 2,
      routeDate: '2026-06-04',
      routeTechnicianCount: 2,
      topTechStopCount: 0,
      topTechOverPreferredMax: false,
      topTechOverHardMax: false,
      dayMismatchWarnings: [],
      topCandidates: [],
      skipReason: null,
      skipLabel: null,
      calibrationOutcome: 'true_scoring_failure',
      countedInRealRoutePassRate: true,
      territoryRepresented: true,
      acceptableTechScheduled: true,
    };
    const scoringResult = {
      topMatches: [
        {
          techName: 'Skyler Ruest',
          routeId: 'R-2026-06-04-SR',
          scores: { total: 92 },
          v2Score: { adjustedTotal: 92, baseTotal: 92, penalties: [], bonuses: [] },
          v2Profile: { eligibilityStatus: 'eligible' },
        },
      ],
    };

    expect(shouldReclassifyFailureFromComparisonDiagnostics(
      result,
      windhamExample,
      technicians,
      scoringResult,
    )).toBe(true);

    const reclassified = reclassifyRealRouteResultAsCorridorOwnerNotScheduled(result);
    expect(reclassified.applicable).toBe(false);
    expect(reclassified.skipReason).toBe('expected_corridor_owner_not_scheduled');
    expect(reclassified.calibrationOutcome).toBe('skipped');
    expect(reclassified.countedInRealRoutePassRate).toBe(false);
  });

  it('filters report failures and recalculates summary when comparison diagnostics exclude Windham', async () => {
    const windhamExample = getValidationExampleById('windham-general-example-024');
    const technicians = [
      {
        techName: 'Paige Bullock',
        routeId: 'R-2026-06-04-PB',
        stops: [{ address: '100 Main St, Westbrook, ME' }],
      },
      {
        techName: 'Ian Pratt',
        routeId: 'R-2026-06-04-IP',
        stops: [{ address: '220 US Route 1, Scarborough, ME' }],
      },
    ];
    const report = {
      routeDate: '2026-06-04',
      fixturePassRate: 1,
      realRoutePassRate: 0.975,
      realRouteApplicableCount: 40,
      realRouteSkippedCount: 14,
      skippedExamples: [],
      techniciansByExampleId: {
        [windhamExample.id]: technicians,
      },
      realRouteFailures: [{
        id: windhamExample.id,
        routeDate: '2026-06-04',
        expectedTechName: 'Chris McGary',
        actualTopTechName: 'Skyler Ruest',
        expectedRank: null,
        failureClassification: 'true_routing_mistake',
        dispatcherConfidence: 'high',
        classificationReason: 'Wrong corridor winner',
        dispatcherReason: windhamExample.dispatcherReason,
        failureReason: 'Expected technician not found in top 3: Chris McGary, Paige Bullock',
        topMatches: [],
        topCandidates: [],
      }],
      realRoute: {
        summary: {
          passRate: 0.975,
          realRouteApplicableCount: 40,
          realRouteSkippedCount: 14,
          skippedExamples: [],
          passed: 39,
          failed: 1,
          totalExamples: 41,
        },
        results: [
          {
            id: 'kennebunk-iq-example-002',
            passed: true,
            applicable: true,
            expectedTechName: 'Joseph Willey',
            actualTopTechName: 'Joseph Willey',
            routeDate: '2026-06-04',
            dispatcherReason: 'Joseph should win',
            failureReason: null,
            expectedRank: 1,
            acceptedRankMax: 1,
            topMatches: [],
            topCandidates: [],
            calibrationOutcome: 'pass',
            countedInRealRoutePassRate: true,
            territoryRepresented: true,
            acceptableTechScheduled: true,
          },
          {
            id: windhamExample.id,
            passed: false,
            applicable: true,
            expectedTechName: 'Chris McGary',
            actualTopTechName: 'Skyler Ruest',
            routeDate: '2026-06-04',
            dispatcherReason: windhamExample.dispatcherReason,
            failureReason: 'Expected technician not found in top 3: Chris McGary, Paige Bullock',
            expectedRank: null,
            acceptedRankMax: 2,
            topMatches: [],
            topCandidates: [],
            calibrationOutcome: 'true_scoring_failure',
            countedInRealRoutePassRate: true,
            territoryRepresented: true,
            acceptableTechScheduled: true,
          },
        ],
      },
      patternReport: { patternsByExampleId: {} },
    };

    const filtered = await applyComparisonDiagnosticFailureFilterToReport(
      report,
      async () => ({
        topMatches: [{
          techName: 'Skyler Ruest',
          routeId: 'R-2026-06-04-SR',
          scores: { total: 92 },
          v2Score: { adjustedTotal: 92, baseTotal: 92, penalties: [], bonuses: [] },
          v2Profile: { eligibilityStatus: 'eligible' },
        }],
      }),
      [windhamExample],
    );

    expect(filtered.comparisonSafetyGateApplied).toBe(true);
    expect(filtered.realRouteFailures).toHaveLength(0);
    expect(filtered.realRoutePassRate).toBe(1);
    expect(filtered.realRouteApplicableCount).toBe(1);
    expect(filtered.realRouteSkippedCount).toBe(1);
    expect(filtered.realRoute.results.find(result => result.id === windhamExample.id)?.applicable)
      .toBe(false);
    expect(filtered.realRoute.results.find(result => result.id === windhamExample.id)?.skipReason)
      .toBe('expected_corridor_owner_not_scheduled');

    const summary = summarizeMultiDateCalibration([filtered]);
    expect(summary.totalApplicableFailures).toBe(0);
    expect(summary.byConfidence.high).toHaveLength(0);
    expect(summary.reportText).toContain('Total applicable failures: 0');
    expect(summary.reportText).toContain('real 100.0%');
    expect(summary.reportText).toContain('0 failures');
    expect(summary.reportText).toContain('None.');
  });

  it('prepareCalibrationReportsForMultiDateSummary filters each report', async () => {
    const windhamExample = getValidationExampleById('windham-general-example-024');
    const technicians = [
      {
        techName: 'Paige Bullock',
        routeId: 'R-2026-06-04-PB',
        stops: [{ address: '100 Main St, Westbrook, ME' }],
      },
    ];
    const reports = [{
      routeDate: '2026-06-04',
      fixturePassRate: 1,
      realRoutePassRate: 0.975,
      realRouteApplicableCount: 1,
      realRouteSkippedCount: 0,
      techniciansByExampleId: { [windhamExample.id]: technicians },
      realRouteFailures: [{
        id: windhamExample.id,
        routeDate: '2026-06-04',
        expectedTechName: 'Chris McGary',
        actualTopTechName: 'Skyler Ruest',
        dispatcherConfidence: 'high',
        failureClassification: 'true_routing_mistake',
      }],
      realRoute: {
        summary: { passRate: 0, realRouteApplicableCount: 1, realRouteSkippedCount: 0, skippedExamples: [] },
        results: [{
          id: windhamExample.id,
          passed: false,
          applicable: true,
          expectedTechName: 'Chris McGary',
          actualTopTechName: 'Skyler Ruest',
          routeDate: '2026-06-04',
          dispatcherReason: windhamExample.dispatcherReason,
        }],
      },
      patternReport: { patternsByExampleId: {} },
    }];

    const prepared = await prepareCalibrationReportsForMultiDateSummary(
      reports,
      async () => ({
        topMatches: [{
          techName: 'Skyler Ruest',
          routeId: 'R-2026-06-04-SR',
          scores: { total: 92 },
          v2Score: { adjustedTotal: 92, baseTotal: 92, penalties: [], bonuses: [] },
          v2Profile: { eligibilityStatus: 'eligible' },
        }],
      }),
      [windhamExample],
    );

    expect(prepared[0].realRouteFailures).toHaveLength(0);
    expect(prepared[0].comparisonSafetyGateApplied).toBe(true);
  });

  it('applyPrintedComparisonsToCalibrationReports uses built comparison diagnostics', () => {
    const windhamExample = getValidationExampleById('windham-general-example-024');
    const report = {
      routeDate: '2026-06-04',
      fixturePassRate: 1,
      realRoutePassRate: 0.975,
      realRouteApplicableCount: 2,
      realRouteSkippedCount: 0,
      realRouteFailures: [{
        id: windhamExample.id,
        routeDate: '2026-06-04',
        expectedTechName: 'Chris McGary',
        actualTopTechName: 'Skyler Ruest',
        dispatcherConfidence: 'high',
        failureClassification: 'true_routing_mistake',
      }],
      realRoute: {
        summary: {
          passRate: 0.5,
          realRouteApplicableCount: 2,
          realRouteSkippedCount: 0,
          skippedExamples: [],
        },
        results: [
          {
            id: 'kennebunk-iq-example-002',
            passed: true,
            applicable: true,
            routeDate: '2026-06-04',
            dispatcherReason: 'ok',
          },
          {
            id: windhamExample.id,
            passed: false,
            applicable: true,
            expectedTechName: 'Chris McGary',
            actualTopTechName: 'Skyler Ruest',
            routeDate: '2026-06-04',
            dispatcherReason: windhamExample.dispatcherReason,
          },
        ],
      },
      patternReport: { patternsByExampleId: {} },
    };
    const printedComparisons = [{
      exampleId: windhamExample.id,
      routeDate: '2026-06-04',
      expectedTechName: 'Chris McGary',
      winningTechName: 'Skyler Ruest',
      expectedTerritory: {
        scheduled: false,
        unavailabilityReasons: ['not_scheduled'],
      },
      winnerTerritory: {
        scheduled: false,
        unavailabilityReasons: ['not_scheduled'],
      },
    }];

    expect(comparisonDiagnosticsIndicateCorridorOwnerNotScheduled(printedComparisons[0])).toBe(true);

    const { reports, windhamSafetyGateApplied, printedComparisons: remaining } =
      applyPrintedComparisonsToCalibrationReports([report], printedComparisons);

    expect(windhamSafetyGateApplied).toBe(true);
    expect(reports[0].realRouteFailures).toHaveLength(0);
    expect(reports[0].realRoutePassRate).toBe(1);
    expect(remaining).toHaveLength(0);

    const summary = summarizeMultiDateCalibration(reports);
    expect(summary.totalApplicableFailures).toBe(0);
    expect(summary.byConfidence.high).toHaveLength(0);
  });

  it('finalizeCalibrationReportForMultiDateOutput reports windham safety gate', async () => {
    const windhamExample = getValidationExampleById('windham-general-example-024');
    const technicians = [
      {
        techName: 'Paige Bullock',
        routeId: 'R-2026-06-04-PB',
        stops: [{ address: '100 Main St, Westbrook, ME' }],
      },
    ];
    const report = {
      routeDate: '2026-06-04',
      fixturePassRate: 1,
      realRoutePassRate: 0.975,
      realRouteApplicableCount: 2,
      realRouteSkippedCount: 0,
      techniciansByExampleId: { [windhamExample.id]: technicians },
      realRouteFailures: [{
        id: windhamExample.id,
        routeDate: '2026-06-04',
        expectedTechName: 'Chris McGary',
        actualTopTechName: 'Skyler Ruest',
        dispatcherConfidence: 'high',
        failureClassification: 'true_routing_mistake',
      }],
      realRoute: {
        summary: {
          passRate: 0.5,
          realRouteApplicableCount: 2,
          realRouteSkippedCount: 0,
          skippedExamples: [],
        },
        results: [
          {
            id: 'kennebunk-iq-example-002',
            passed: true,
            applicable: true,
            routeDate: '2026-06-04',
            dispatcherReason: 'ok',
          },
          {
            id: windhamExample.id,
            passed: false,
            applicable: true,
            expectedTechName: 'Chris McGary',
            actualTopTechName: 'Skyler Ruest',
            routeDate: '2026-06-04',
            dispatcherReason: windhamExample.dispatcherReason,
          },
        ],
      },
      patternReport: { patternsByExampleId: {} },
    };

    const { report: finalized, windhamSafetyGateApplied } = await finalizeCalibrationReportForMultiDateOutput(
      report,
      async () => ({
        topMatches: [{
          techName: 'Skyler Ruest',
          routeId: 'R-2026-06-04-SR',
          scores: { total: 92 },
          v2Score: { adjustedTotal: 92, baseTotal: 92, penalties: [], bonuses: [] },
          v2Profile: { eligibilityStatus: 'eligible' },
        }],
      }),
      [windhamExample],
    );

    expect(windhamSafetyGateApplied).toBe(true);
    expect(finalized.realRouteFailures).toHaveLength(0);
    expect(finalized.realRoutePassRate).toBe(1);

    const summary = summarizeMultiDateCalibration([report, finalized]);
    expect(summary.totalApplicableFailures).toBe(1);
    const finalizedSummary = summarizeMultiDateCalibration([finalized]);
    expect(finalizedSummary.totalApplicableFailures).toBe(0);
    expect(finalizedSummary.byConfidence.high).toHaveLength(0);
  });
});
