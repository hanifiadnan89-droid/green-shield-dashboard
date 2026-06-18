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
      throw new Error(
        'No normalized route cache found under data/routes/. '
        + 'Place a scraped *.normalized.json file there or run: node scripts/seedRouteCache.mjs YYYY-MM-DD',
      );
    }

    const report = await runValidationCalibration({
      routeDate: selected.date,
      print: false,
    });

    expect(report.fixture.summary.totalExamples).toBe(54);
    expect(report.fixturePassRate).toBe(1);
    expect(report.realRoute.summary.totalExamples).toBe(54);
    expect(report.patternReport).toBeTruthy();
    expect(report.patternReportText).toContain('Grouped failure patterns');
    expect(report.reportText).toContain(`fixturePassRate: ${formatValidationPassRate(report.fixturePassRate)}`);
    expect(report.reportText).toContain(`realRoutePassRate: ${formatValidationPassRate(report.realRoutePassRate)}`);

    console.log('\n' + report.reportText);
    console.log('\n[calibration] route cache summary', selected);
  }, 300000);
});
