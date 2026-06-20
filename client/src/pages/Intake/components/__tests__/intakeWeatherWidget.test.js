import { describe, expect, it } from 'vitest';
import {
  formatWeatherConditionLabel,
  formatWeatherTemperature,
  resolveWeatherTheme,
} from '../IntakeWeatherWidget.jsx';

describe('IntakeWeatherWidget helpers', () => {
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

  describe('formatWeatherConditionLabel', () => {
    it('formats common weather types', () => {
      expect(formatWeatherConditionLabel({ weatherType: 'PARTLY_CLOUDY' })).toBe('Partly Cloudy');
      expect(formatWeatherConditionLabel({ weatherType: 'THUNDERSTORM' })).toBe('Storms');
      expect(formatWeatherConditionLabel({ weatherType: 'CLEAR' })).toBe('Sunny');
    });
  });

  describe('formatWeatherTemperature', () => {
    it('formats temperature when available', () => {
      expect(formatWeatherTemperature({ temperatureF: 68.4 })).toBe('68°F');
    });

    it('returns fallback when unavailable', () => {
      expect(formatWeatherTemperature({})).toBe('Unavailable');
    });
  });
});
