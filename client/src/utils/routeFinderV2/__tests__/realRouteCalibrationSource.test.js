import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CALIBRATION_ROUTE_DATE,
  pickCalibrationRouteDateFromList,
} from '../realRouteCalibrationSource.js';

describe('realRouteCalibrationSource date selection', () => {
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
});
