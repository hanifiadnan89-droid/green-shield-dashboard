import { describe, it, expect } from 'vitest';
import { evaluateWeatherSuitability } from '../weatherSuitability.js';

describe('evaluateWeatherSuitability', () => {
  it('returns good when rain is low, wind light, and temp above 50', () => {
    const result = evaluateWeatherSuitability({
      rainProbabilityPercent: 20,
      measurableRainExpected: false,
      windSpeedMph: 10,
      temperatureF: 68,
      weatherType: 'CLEAR',
    });
    expect(result.level).toBe('good');
    expect(result.label).toBe('Good for T/M');
  });

  it('returns monitor for borderline rain and wind', () => {
    const result = evaluateWeatherSuitability({
      rainProbabilityPercent: 45,
      measurableRainExpected: false,
      windSpeedMph: 16,
      temperatureF: 70,
      weatherType: 'CLOUDY',
    });
    expect(result.level).toBe('monitor');
    expect(result.label).toBe('Monitor');
  });

  it('returns not recommended for thunderstorms or heavy rain', () => {
    const storm = evaluateWeatherSuitability({
      rainProbabilityPercent: 30,
      measurableRainExpected: false,
      windSpeedMph: 10,
      temperatureF: 70,
      weatherType: 'THUNDERSTORM',
    });
    expect(storm.level).toBe('not_recommended');

    const heavyRain = evaluateWeatherSuitability({
      rainProbabilityPercent: 60,
      measurableRainExpected: true,
      windSpeedMph: 10,
      temperatureF: 70,
      weatherType: 'RAIN',
    });
    expect(heavyRain.level).toBe('not_recommended');
  });

  it('returns monitor when temperature is at or below 50F', () => {
    const result = evaluateWeatherSuitability({
      rainProbabilityPercent: 10,
      measurableRainExpected: false,
      windSpeedMph: 8,
      temperatureF: 48,
      weatherType: 'CLEAR',
    });
    expect(result.level).toBe('monitor');
  });
});
