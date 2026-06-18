/**
 * Weather suitability rules for Tick & Mosquito treatment scheduling.
 * Recommendations only — never blocks scheduling.
 *
 * @param {object} weather
 * @returns {{ level: 'good'|'monitor'|'not_recommended', label: string, reasons: string[] }}
 */
export function evaluateWeatherSuitability(weather = {}) {
  const reasons = [];
  const rainProb = Number(weather.rainProbabilityPercent);
  const wind = Number(weather.windSpeedMph);
  const gust = Number(weather.windGustMph);
  const temp = Number(weather.temperatureF);
  const measurableRain = weather.measurableRainExpected === true;
  const weatherType = String(weather.weatherType || '').toUpperCase();

  const thunderstorm = weatherType.includes('THUNDER')
    || weatherType.includes('STORM')
    || weatherType.includes('LIGHTNING');

  if (thunderstorm) reasons.push('Thunderstorms expected');
  if (measurableRain) reasons.push('Measurable rain expected');
  if (Number.isFinite(rainProb) && rainProb > 50) reasons.push(`Rain probability ${rainProb}%`);
  if (Number.isFinite(gust) && gust > 20) reasons.push(`Wind gusts up to ${Math.round(gust)} mph`);
  if (!Number.isFinite(gust) && Number.isFinite(wind) && wind > 20) {
    reasons.push(`Wind ${Math.round(wind)} mph`);
  }

  if (reasons.length > 0) {
    return {
      level: 'not_recommended',
      label: 'Not Recommended',
      reasons,
    };
  }

  const monitorReasons = [];
  if (Number.isFinite(rainProb) && rainProb >= 40 && rainProb <= 50) {
    monitorReasons.push(`Rain probability ${rainProb}%`);
  }
  if (Number.isFinite(wind) && wind >= 15 && wind <= 20) {
    monitorReasons.push(`Wind ${Math.round(wind)} mph`);
  }

  if (monitorReasons.length > 0) {
    return {
      level: 'monitor',
      label: 'Monitor',
      reasons: monitorReasons,
    };
  }

  const goodReasons = [];
  if (Number.isFinite(temp) && temp <= 50) {
    return {
      level: 'monitor',
      label: 'Monitor',
      reasons: [`Temperature ${Math.round(temp)}°F — borderline for T/M`],
    };
  }

  if (Number.isFinite(rainProb) && rainProb < 40) goodReasons.push(`Rain probability ${rainProb}%`);
  if (!measurableRain) goodReasons.push('No measurable rain expected');
  if (Number.isFinite(wind) && wind < 15) goodReasons.push(`Wind ${Math.round(wind)} mph`);
  if (Number.isFinite(temp) && temp > 50) goodReasons.push(`Temperature ${Math.round(temp)}°F`);

  return {
    level: 'good',
    label: 'Good for T/M',
    reasons: goodReasons.length ? goodReasons : ['Conditions look favorable'],
  };
}
