import { describe, it, expect, vi, afterAll } from 'vitest';
import {
  buildRealRouteCandidateDiagnostic,
  collectRealRouteFailures,
  enrichRealRouteValidationResult,
  extractDayMismatchWarnings,
} from '../validationCalibrationDiagnostics.js';
import {
  formatValidationCalibrationReport,
  runValidationCalibration,
} from '../runValidationCalibration.js';
import {
  listCachedRouteDates,
  loadNormalizedRoutesFromDisk,
  resolveCalibrationRouteDate,
} from '../realRouteCalibrationSource.js';
import { loadMockRealRoutesForDate } from '../testFixtures/realRouteCalibration.fixture.js';
import { getValidationExamples } from '../validationExamples.js';
import { formatValidationPassRate } from '../runValidationReport.js';
import { assertValidationReportDevOnly, isValidationReportAllowed } from '../runValidationReport.js';

function makeMatch(techName, extras = {}) {
  return {
    techName,
    routeId: extras.routeId ?? `R-${techName}`,
    scores: { total: extras.baseTotal ?? 80 },
    v2Score: {
      baseTotal: extras.baseTotal ?? 80,
      adjustedTotal: extras.adjustedTotal ?? 80,
      penalties: extras.penalties ?? [],
      bonuses: extras.bonuses ?? [],
    },
    v2Profile: {
      eligibilityStatus: extras.eligibilityStatus ?? 'eligible',
      overPreferredMaxStops: extras.overPreferredMaxStops ?? false,
      overHardMaxStops: extras.overHardMaxStops ?? false,
      warnings: extras.warnings ?? [],
      nhRouteDayMatch: extras.nhRouteDayMatch ?? null,
    },
  };
}

describe('validationCalibrationDiagnostics', () => {
  it('extracts NH day mismatch warnings from v2Profile', () => {
    const warnings = extractDayMismatchWarnings({
      warnings: ['Route exceeds preferred stop limit', 'NH route day does not match sub-region schedule'],
    });
    expect(warnings).toEqual(['NH route day does not match sub-region schedule']);
  });

  it('builds enriched real-route candidate diagnostics', () => {
    const technicians = [{ routeId: 'R-1', stops: [{}, {}, {}] }];
    const candidate = buildRealRouteCandidateDiagnostic(
      makeMatch('Joseph Willey', {
        routeId: 'R-1',
        overPreferredMaxStops: true,
        penalties: [{ code: 'over_preferred_stops', label: 'Over preferred', points: 12 }],
      }),
      1,
      technicians,
    );

    expect(candidate.stopCount).toBe(3);
    expect(candidate.overPreferredMaxStops).toBe(true);
    expect(candidate.penalties).toHaveLength(1);
  });

  it('enriches validation results with route context', () => {
    const enriched = enrichRealRouteValidationResult({
      id: 'example-1',
      passed: false,
      expectedTechName: 'Joseph Willey',
      actualTopTechName: 'Ian Pratt',
      expectedRank: null,
      acceptedRankMax: 1,
      topMatches: [],
      failureReason: 'Expected technician not found in top 3',
      dispatcherReason: 'Dispatcher reason',
      notes: '',
      technicianCount: 2,
    }, {
      routeDate: '2026-06-18',
      technicians: [{ routeId: 'R-1', stops: [{}, {}] }],
      scoringResult: {
        topMatches: [makeMatch('Ian Pratt', { routeId: 'R-1' })],
      },
    });

    expect(enriched.routeDate).toBe('2026-06-18');
    expect(enriched.topTechStopCount).toBe(2);
    expect(enriched.topCandidates).toHaveLength(1);
  });

  it('collects real-route failure summaries with required fields', () => {
    const failures = collectRealRouteFailures([
      enrichRealRouteValidationResult({
        id: 'example-1',
        passed: false,
        expectedTechName: 'Joseph Willey',
        actualTopTechName: 'Ian Pratt',
        expectedRank: null,
        acceptedRankMax: 1,
        topMatches: [],
        failureReason: 'Expected technician not found in top 3',
        dispatcherReason: 'Dispatcher reason',
        notes: '',
        technicianCount: 2,
      }, {
        routeDate: '2026-06-18',
        technicians: [{ routeId: 'R-1', stops: [{}, {}] }],
        scoringResult: {
          topMatches: [makeMatch('Ian Pratt', { routeId: 'R-1', overPreferredMaxStops: true })],
        },
      }),
    ]);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      expectedTechName: 'Joseph Willey',
      actualTopTechName: 'Ian Pratt',
      stopCount: 2,
      overPreferredMax: true,
      dispatcherReason: 'Dispatcher reason',
    });
    expect(failures[0].topCandidates).toHaveLength(1);
  });
});

describe('realRouteCalibrationSource', () => {
  it('resolves per-example route date when no override is provided', () => {
    const example = getValidationExamples()[0];
    expect(resolveCalibrationRouteDate(example, null)).toBe(example.date);
    expect(resolveCalibrationRouteDate(example, '2026-06-18')).toBe('2026-06-18');
  });

  it('loads normalized routes from disk when cache exists', async () => {
    const dates = await listCachedRouteDates();
    if (!dates.length) {
      expect(await loadNormalizedRoutesFromDisk('2099-01-01')).toBeNull();
      return;
    }

    const payload = await loadNormalizedRoutesFromDisk(dates[0]);
    expect(payload?.technicians).toBeInstanceOf(Array);
  });
});

describe('runValidationCalibration', () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('is blocked in production builds', () => {
    vi.stubEnv('PROD', 'true');
    expect(isValidationReportAllowed()).toBe(false);
    expect(() => assertValidationReportDevOnly()).toThrow(/DEV-only/);
    vi.unstubAllEnvs();
  });

  it('formats dual baseline calibration report', () => {
    const text = formatValidationCalibrationReport({
      routeDate: '2026-06-18',
      fixturePassRate: 1,
      realRoutePassRate: 0.5,
      fixtureFailures: [],
      realRouteFailures: [{
        id: 'example-fail',
        routeDate: '2026-06-18',
        expectedTechName: 'Joseph Willey',
        actualTopTechName: 'Ian Pratt',
        expectedRank: null,
        failureReason: 'Expected technician not found in top 3',
        dispatcherReason: 'Dispatcher reason',
        stopCount: 5,
        overPreferredMax: true,
        overHardMax: false,
        dayMismatchWarnings: [],
        topCandidates: [{
          rank: 1,
          techName: 'Ian Pratt',
          stopCount: 5,
          baseTotal: 90,
          adjustedTotal: 85,
          eligibilityStatus: 'eligible',
          overPreferredMaxStops: true,
          overHardMaxStops: false,
          dayMismatchWarnings: [],
          penalties: [{ code: 'weak_geo_cluster', label: 'Weak', points: 8 }],
          bonuses: [],
        }],
        topMatches: [],
      }],
      fixture: {
        summary: { totalExamples: 2, passed: 2, failed: 0, passRate: 1, failures: [] },
        results: [],
      },
      realRoute: {
        summary: { totalExamples: 2, passed: 1, failed: 1, passRate: 0.5, failures: [] },
        results: [],
      },
      reportText: '',
    });

    expect(text).toContain('fixturePassRate');
    expect(text).toContain('realRoutePassRate');
    expect(text).toContain('fixtureFailures');
    expect(text).toContain('realRouteFailures');
    expect(text).toContain('stopCount: 5');
    expect(text).toContain('over preferred max?: true');
    expect(text).toContain('candidate top 3');
    expect(text).toContain('dispatcherReason: Dispatcher reason');
  });

  it('runs fixture and real-route baselines separately with mock routes', async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');

    const examples = getValidationExamples().slice(0, 1);
    const report = await runValidationCalibration({
      routeDate: '2026-06-17',
      examples,
      print: false,
      loadRoutesForDate: loadMockRealRoutesForDate,
    });

    expect(report.fixturePassRate).toBe(1);
    expect(report.fixture.summary.passed).toBe(1);
    expect(report.realRoute.summary.totalExamples).toBe(1);
    expect(report.fixtureFailures).toHaveLength(0);
    expect(report.routeDate).toBe('2026-06-17');
    expect(report.reportText).toContain('Validation Calibration Report');
  });

  it('full calibration report against deterministic fixtures and mock real routes', async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');

    const report = await runValidationCalibration({
      routeDate: '2026-06-18',
      print: false,
      loadRoutesForDate: loadMockRealRoutesForDate,
    });

    expect(report.fixture.summary.totalExamples).toBe(54);
    expect(report.fixturePassRate).toBe(1);
    expect(report.fixtureFailures).toHaveLength(0);
    expect(report.realRoute.summary.totalExamples).toBe(54);
    expect(report.realRoutePassRate).toBeLessThanOrEqual(1);
    expect(report.reportText).toContain(`fixturePassRate: ${formatValidationPassRate(report.fixturePassRate)}`);
    expect(report.reportText).toContain(`realRoutePassRate: ${formatValidationPassRate(report.realRoutePassRate)}`);

    console.log('\n' + report.reportText);
  }, 180000);
});
