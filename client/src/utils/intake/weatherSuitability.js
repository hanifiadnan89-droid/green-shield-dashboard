/**
 * Weather suitability rules for Tick & Mosquito treatment scheduling.
 * Recommendations are based primarily on rain probability.
 * Wind is supporting information only — never drives the recommendation level.
 *
 * @param {object} weather
 * @returns {{ level: 'good'|'monitor'|'not_recommended', label: string, reasons: string[] }}
 */
export function evaluateWeatherSuitability(weather = {}) {
  const rainProb = Number(weather.rainProbabilityPercent);
  const wind = Number(weather.windSpeedMph);
  const gust = Number(weather.windGustMph);
  const temp = Number(weather.temperatureF);

  const reasons = [];

  if (Number.isFinite(rainProb)) {
    if (rainProb <= 30) {
      reasons.push(`Rain probability ${rainProb}%`);
    } else if (rainProb <= 50) {
      reasons.push(`Rain probability ${rainProb}% — moderate chance`);
    } else {
      reasons.push(`Rain probability ${rainProb}% — elevated chance`);
    }
  } else {
    reasons.push('Rain probability unavailable');
  }

  if (Number.isFinite(gust)) {
    reasons.push(`Wind gusts up to ${Math.round(gust)} mph`);
  } else if (Number.isFinite(wind)) {
    reasons.push(`Wind ${Math.round(wind)} mph`);
  }

  if (Number.isFinite(temp)) {
    reasons.push(`Temperature ${Math.round(temp)}°F`);
  }

  if (!Number.isFinite(rainProb)) {
    return {
      level: 'monitor',
      label: 'Moderation Needed',
      reasons,
    };
  }

  if (rainProb > 50) {
    return {
      level: 'not_recommended',
      label: 'Not Recommended',
      reasons,
    };
  }

  if (rainProb > 30) {
    return {
      level: 'monitor',
      label: 'Moderation Needed',
      reasons,
    };
  }

  return {
    level: 'good',
    label: 'Recommended',
    reasons,
  };
}
