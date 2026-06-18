import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { runValidationCalibration } from '../runValidationCalibration.js';
import { resolveCalibrationRouteDateForRun } from '../realRouteCalibrationSource.js';
import { formatValidationPassRate } from '../runValidationReport.js';

describe('runValidationCalibrationReport', () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('real cached route calibration with grouped failure patterns', async () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');

    const selected = await resolveCalibrationRouteDateForRun();
    if (!selected) {
      console.warn(
        '[calibration] Skipping real cache test — no normalized route cache under data/routes/.',
      );
      return;
    }

    if (process.env.ROUTE_DATE) {
      expect(selected.date).toBe(process.env.ROUTE_DATE);
      expect(selected.selection).toBe('requested');
    }

    const report = await runValidationCalibration({
      routeDate: selected.date,
      print: false,
    });

    expect(report.routeDate).toBe(selected.date);

    expect(report.fixture.summary.totalExamples).toBe(54);
    expect(report.fixturePassRate).toBe(1);
    expect(report.realRoute.summary.totalExamples).toBe(54);
    expect(report.realRouteApplicableCount + report.realRouteSkippedCount).toBe(54);
    expect(report.reportText).toContain('realRouteApplicableCount');
    expect(report.reportText).toContain('realRouteSkippedCount');
    expect(report.reportText).toContain('Skipped / not applicable');

    console.log('\n' + report.reportText);
    console.log('\n[calibration] route cache summary', selected);
  }, 300000);
});
