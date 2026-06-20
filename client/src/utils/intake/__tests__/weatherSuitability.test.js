import { describe, it, expect } from 'vitest';
import { evaluateWeatherSuitability } from '../weatherSuitability.js';

describe('evaluateWeatherSuitability', () => {
  it('returns Recommended when rain is 30% or lower', () => {
    const result = evaluateWeatherSuitability({
      rainProbabilityPercent: 20,
      windSpeedMph: 10,
      temperatureF: 68,
      weatherType: 'CLEAR',
    });
    expect(result.level).toBe('good');
    expect(result.label).toBe('Recommended');
  });

  it('returns Recommended at exactly 30% rain even with high wind', () => {
    const result = evaluateWeatherSuitability({
      rainProbabilityPercent: 30,
      windSpeedMph: 27,
      windGustMph: 50,
      temperatureF: 68,
      weatherType: 'PARTLY_CLOUDY',
    });
    expect(result.level).toBe('good');
    expect(result.label).toBe('Recommended');
    expect(result.reasons.some((r) => r.includes('Wind gusts'))).toBe(true);
  });

  it('returns Moderation Needed when rain is above 30% and up to 50%', () => {
    const result = evaluateWeatherSuitability({
      rainProbabilityPercent: 45,
      windSpeedMph: 16,
      temperatureF: 70,
      weatherType: 'CLOUDY',
    });
    expect(result.level).toBe('monitor');
    expect(result.label).toBe('Moderation Needed');
  });

  it('returns Not Recommended when rain is above 50%', () => {
    const heavyRain = evaluateWeatherSuitability({
      rainProbabilityPercent: 60,
      windSpeedMph: 10,
      temperatureF: 70,
      weatherType: 'RAIN',
    });
    expect(heavyRain.level).toBe('not_recommended');
    expect(heavyRain.label).toBe('Not Recommended');
  });

  it('does not downgrade to Not Recommended based on wind alone', () => {
    const result = evaluateWeatherSuitability({
      rainProbabilityPercent: 20,
      windSpeedMph: 27,
      windGustMph: 50,
      temperatureF: 70,
      weatherType: 'THUNDERSTORM',
    });
    expect(result.level).toBe('good');
    expect(result.label).toBe('Recommended');
  });
});
