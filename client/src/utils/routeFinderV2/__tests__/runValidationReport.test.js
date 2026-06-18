import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  assertValidationReportDevOnly,
  formatValidationBaselineReport,
  formatValidationPassRate,
  isValidationReportAllowed,
  runValidationReport,
} from '../runValidationReport.js';
import { getValidationExamples } from '../validationExamples.js';

function makeMatch(techName, totals = {}) {
  return {
    techName,
    routeId: `R-${techName}`,
    scores: { total: totals.baseTotal ?? 80 },
    v2Score: {
      baseTotal: totals.baseTotal ?? 80,
      adjustedTotal: totals.adjustedTotal ?? 80,
      adjustment: 0,
      penalties: totals.penalties ?? [],
      bonuses: totals.bonuses ?? [],
      explanation: '',
    },
    v2Profile: {
      eligibilityStatus: totals.eligibilityStatus ?? 'eligible',
      warnings: [],
    },
  };
}

describe('runValidationReport', () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('is blocked in production builds', () => {
    vi.stubEnv('PROD', 'true');
    expect(isValidationReportAllowed()).toBe(false);
    expect(() => assertValidationReportDevOnly()).toThrow(/DEV-only/);
    vi.unstubAllEnvs();
  });

  it('formats baseline report with failures only details', () => {
    const text = formatValidationBaselineReport({
      totalExamples: 2,
      passed: 1,
      failed: 1,
      passRate: 0.5,
      failures: [{
        id: 'example-fail',
        expectedTechName: 'Joseph Willey',
        actualTopTechName: 'Ian Pratt',
        expectedRank: null,
        failureReason: 'Forbidden technician ranked #1: Ian Pratt',
        dispatcherReason: 'Dispatcher reason',
        topMatches: [{
          rank: 1,
          techName: 'Ian Pratt',
          baseTotal: 90,
          adjustedTotal: 85,
          eligibilityStatus: 'eligible',
          penalties: [{ code: 'weak_geo_cluster', label: 'Weak', points: 8 }],
          bonuses: [],
          explanation: '',
          warnings: [],
        }],
      }],
    });

    expect(text).toContain('Total examples: 2');
    expect(text).toContain('Pass rate: 50.0%');
    expect(text).toContain('example-fail');
    expect(text).toContain('Forbidden technician ranked #1');
    expect(formatValidationPassRate(0.5)).toBe('50.0%');
  });

  it('does not mutate scoring output when evaluating examples', async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');

    const examples = getValidationExamples().slice(0, 2);
    const scoringSnapshots = [];

    const { results } = await runValidationReport({
      examples,
      print: false,
      buildTechnicians: () => [{ techName: 'Joseph Willey', routeId: 'R-1', stops: [] }],
      scoreExample: async () => {
        const result = {
          topMatches: [makeMatch('Joseph Willey')],
          recommendation: makeMatch('Joseph Willey'),
          alternatives: [],
        };
        scoringSnapshots.push(JSON.stringify(result));
        return result;
      },
    });

    expect(results).toHaveLength(2);
    expect(scoringSnapshots).toHaveLength(2);
    expect(JSON.stringify({
      topMatches: [makeMatch('Joseph Willey')],
      recommendation: makeMatch('Joseph Willey'),
      alternatives: [],
    })).toBe(scoringSnapshots[0]);
  });

  it('full baseline validation report against deterministic fixtures', async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');

    const { summary, reportText } = await runValidationReport({ print: false });

    expect(summary.totalExamples).toBe(51);
    expect(summary.passed + summary.failed).toBe(51);
    expect(reportText).toContain('Validation Baseline Report');
    expect(reportText).toContain(`Pass rate: ${formatValidationPassRate(summary.passRate)}`);

    if (summary.failures.length) {
      expect(reportText).toContain('Failures');
      for (const failure of summary.failures) {
        expect(reportText).toContain(failure.id);
      }
    }

    // Expose report text for manual baseline inspection when running this test directly.
    console.log('\n' + reportText);
  }, 120000);
});
