import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CALIBRATION_ROUTE_DATE_ENV,
  DEFAULT_CALIBRATION_ROUTE_DATE,
  isValidCalibrationRouteDate,
  parseCalibrationRouteDateFromArgv,
  pickCalibrationRouteDateFromList,
  resolveCalibrationRouteDateForRun,
  resolveRequestedCalibrationRouteDate,
} from '../realRouteCalibrationSource.js';

describe('realRouteCalibrationSource date selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env[CALIBRATION_ROUTE_DATE_ENV];
  });

  it('prefers the default calibration date when it exists in cache list', () => {
    const dates = ['2026-06-01', '2026-06-06', DEFAULT_CALIBRATION_ROUTE_DATE];
    expect(pickCalibrationRouteDateFromList(dates)).toBe(DEFAULT_CALIBRATION_ROUTE_DATE);
  });

  it('falls back to the latest available date when preferred date is missing', () => {
    const dates = ['2026-06-01', '2026-06-03', '2026-06-06'];
    expect(pickCalibrationRouteDateFromList(dates)).toBe('2026-06-06');
  });

  it('returns null when no cached dates exist', () => {
    expect(pickCalibrationRouteDateFromList([])).toBeNull();
  });

  it('parses --routeDate from argv without passing it to vitest', () => {
    expect(parseCalibrationRouteDateFromArgv(['--routeDate=2026-06-05', 'run', 'test'])).toBe('2026-06-05');
    expect(parseCalibrationRouteDateFromArgv(['--routeDate', '2026-06-04'])).toBe('2026-06-04');
    expect(resolveRequestedCalibrationRouteDate({ argv: ['--routeDate=2026-06-04'] })).toBe('2026-06-04');
  });

  it('uses ROUTE_DATE env exactly without falling back to latest_available', async () => {
    vi.stubEnv(CALIBRATION_ROUTE_DATE_ENV, '2026-06-05');

    const loadedDates = [];
    const mockLoad = async (date) => {
      loadedDates.push(date);
      if (date === '2026-06-05') {
        return { technicians: [{ techName: 'Tech A', stops: [] }], date: '2026-06-05' };
      }
      if (date === '2026-06-06') {
        return {
          technicians: [
            { techName: 'Tech B', stops: [{}] },
            { techName: 'Tech C', stops: [{}] },
          ],
          date: '2026-06-06',
        };
      }
      return null;
    };

    const selected = await resolveCalibrationRouteDateForRun({ loadNormalizedRoutes: mockLoad });

    expect(selected?.date).toBe('2026-06-05');
    expect(selected?.selection).toBe('requested');
    expect(loadedDates).toEqual(['2026-06-05']);
  });

  it('fails clearly when requested route file does not exist', async () => {
    vi.stubEnv(CALIBRATION_ROUTE_DATE_ENV, '2026-06-05');

    await expect(resolveCalibrationRouteDateForRun({
      loadNormalizedRoutes: async () => null,
    })).rejects.toThrow('data/routes/2026-06-05.normalized.json not found');
  });

  it('validates ROUTE_DATE format', async () => {
    vi.stubEnv(CALIBRATION_ROUTE_DATE_ENV, 'not-a-date');

    await expect(resolveCalibrationRouteDateForRun({
      loadNormalizedRoutes: async () => null,
    })).rejects.toThrow(/Invalid ROUTE_DATE/);

    expect(isValidCalibrationRouteDate('2026-06-05')).toBe(true);
    expect(isValidCalibrationRouteDate('06-05-2026')).toBe(false);
  });

  it('auto-picks latest_available only when no route date is provided', async () => {
    const loadedDates = [];
    const mockLoad = async (date) => {
      loadedDates.push(date);
      if (date === DEFAULT_CALIBRATION_ROUTE_DATE) return null;
      if (date === '2026-06-06') {
        return { technicians: [{ techName: 'Tech', stops: [{}] }], date };
      }
      return null;
    };

    const listDates = async () => ['2026-06-01', '2026-06-06'];

    const selected = await resolveCalibrationRouteDateForRun({
      loadNormalizedRoutes: mockLoad,
      listCachedRouteDates: listDates,
    });

    expect(selected?.date).toBe('2026-06-06');
    expect(selected?.selection).toBe('latest_available');
    expect(loadedDates).toContain(DEFAULT_CALIBRATION_ROUTE_DATE);
    expect(loadedDates).toContain('2026-06-06');
  });
});
