import { describe, expect, it } from 'vitest';
import { resolveWeatherTheme } from '../IntakeWeatherWidget.jsx';

describe('resolveWeatherTheme', () => {
  it('detects storm conditions', () => {
    expect(resolveWeatherTheme({ weatherType: 'THUNDERSTORM' })).toBe('storm');
  });

  it('detects rain from probability', () => {
    expect(resolveWeatherTheme({ rainProbabilityPercent: 60 })).toBe('rain');
  });

  it('detects windy conditions', () => {
    expect(resolveWeatherTheme({ windSpeedMph: 22, weatherType: 'PARTLY_CLOUDY' })).toBe('windy');
  });

  it('defaults to sunny for clear conditions', () => {
    expect(resolveWeatherTheme({ weatherType: 'CLEAR', rainProbabilityPercent: 10, windSpeedMph: 8 })).toBe('sunny');
  });
});
