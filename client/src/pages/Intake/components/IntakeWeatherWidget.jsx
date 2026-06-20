import { Cloud, CloudRain, CloudSun, Sun, Wind, Zap } from 'lucide-react';
import IntakeInputField from './IntakeInputField.jsx';

export function weatherRecommendationClass(level) {
  if (level === 'good') return 'intake-weather-widget__metric-value--good';
  if (level === 'monitor') return 'intake-weather-widget__metric-value--monitor';
  if (level === 'not_recommended') return 'intake-weather-widget__metric-value--not_recommended';
  return '';
}

export function formatWeatherConditionLabel(weather) {
  const type = String(weather?.weatherType || '').toUpperCase().replace(/-/g, '_');
  if (!type) return 'Forecast pending';
  if (type.includes('THUNDER') || type.includes('LIGHTNING')) return 'Storms';
  if (type.includes('STORM')) return 'Storms';
  if (type.includes('PARTLY') && type.includes('CLOUD')) return 'Partly Cloudy';
  if (type.includes('MOSTLY') && type.includes('CLOUD')) return 'Mostly Cloudy';
  if (type.includes('OVERCAST')) return 'Overcast';
  if (type.includes('CLOUD')) return 'Cloudy';
  if (type.includes('DRIZZLE')) return 'Drizzle';
  if (type.includes('SHOWER') || type.includes('RAIN')) return 'Rain';
  if (type.includes('FOG') || type.includes('MIST')) return 'Foggy';
  if (type.includes('WIND')) return 'Windy';
  if (type.includes('CLEAR') || type.includes('SUNNY') || type === 'SUN') return 'Sunny';
  return type
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function resolveWeatherTheme(weather) {
  const type = String(weather?.weatherType || '').toUpperCase();
  const rain = Number(weather?.rainProbabilityPercent);
  const wind = Number(weather?.windSpeedMph);

  if (type.includes('THUNDER') || type.includes('STORM') || type.includes('LIGHTNING')) {
    return 'storm';
  }
  if (type.includes('RAIN') || type.includes('DRIZZLE') || type.includes('SHOWER')) {
    return 'rain';
  }
  if (Number.isFinite(rain) && rain >= 45) return 'rain';
  if (type.includes('WIND') || (Number.isFinite(wind) && wind >= 18)) return 'windy';
  if (type.includes('PARTLY')) return 'windy';
  if (type.includes('CLOUD') || type.includes('OVERCAST') || type.includes('FOG')) return 'cloudy';
  if (type.includes('CLEAR') || type.includes('SUN')) return 'sunny';
  if (Number.isFinite(rain) && rain >= 25) return 'cloudy';
  return 'sunny';
}

function WeatherIcon({ theme }) {
  const props = { size: 28, strokeWidth: 1.75, className: 'intake-weather-widget__icon' };
  if (theme === 'storm') return <Zap {...props} />;
  if (theme === 'rain') return <CloudRain {...props} />;
  if (theme === 'windy') return <Wind {...props} />;
  if (theme === 'cloudy') return <Cloud {...props} />;
  if (theme === 'sunny') return <Sun {...props} />;
  return <CloudSun {...props} />;
}

function formatWind(weather) {
  const gust = Number(weather?.windGustMph);
  const wind = Number(weather?.windSpeedMph);
  if (Number.isFinite(gust) && Number.isFinite(wind)) return `${Math.round(wind)} mph · gusts ${Math.round(gust)}`;
  if (Number.isFinite(wind)) return `${Math.round(wind)} mph`;
  if (Number.isFinite(gust)) return `gusts ${Math.round(gust)} mph`;
  return '—';
}

function WeatherBackdrop({ theme }) {
  return (
    <div className="intake-weather-widget__backdrop" aria-hidden>
      <div className="intake-weather-widget__layer intake-weather-widget__layer--glow" />

      {theme === 'sunny' && (
        <>
          <div className="intake-weather-widget__layer intake-weather-widget__layer--sun" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--shimmer" />
        </>
      )}

      {theme === 'rain' && (
        <>
          <div className="intake-weather-widget__layer intake-weather-widget__layer--rain-clouds" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--rain" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--rain intake-weather-widget__layer--rain-alt" />
        </>
      )}

      {theme === 'storm' && (
        <>
          <div className="intake-weather-widget__layer intake-weather-widget__layer--storm" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--storm-clouds" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--lightning" />
        </>
      )}

      {theme === 'cloudy' && (
        <>
          <div className="intake-weather-widget__layer intake-weather-widget__layer--clouds" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--clouds intake-weather-widget__layer--clouds-alt" />
        </>
      )}

      {theme === 'windy' && (
        <>
          <div className="intake-weather-widget__layer intake-weather-widget__layer--wind-clouds" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--wind-clouds intake-weather-widget__layer--wind-clouds-alt" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--wind-mist" />
          <div className="intake-weather-widget__layer intake-weather-widget__layer--wind-gusts" />
        </>
      )}
    </div>
  );
}

export default function IntakeWeatherWidget({
  weatherDate,
  onWeatherDateChange,
  weather,
  suitability,
  loading = false,
  error = null,
}) {
  const theme = weather ? resolveWeatherTheme(weather) : 'cloudy';
  const conditionLabel = weather ? formatWeatherConditionLabel(weather) : 'Awaiting forecast';

  return (
    <section className={`intake-weather-widget intake-weather-widget--${theme}`}>
      <WeatherBackdrop theme={theme} />

      <div className="intake-weather-widget__content">
        <div className="intake-weather-widget__header">
          <div>
            <p className="intake-weather-widget__eyebrow">Weather Suitability</p>
            <h2 className="intake-weather-widget__title">Service Conditions</h2>
          </div>
          <WeatherIcon theme={theme} />
        </div>

        <div className="intake-weather-widget__controls">
          <IntakeInputField id="weatherDate" label="Service Date">
            <input
              id="weatherDate"
              type="date"
              className="intake-input intake-weather-widget__date"
              value={weatherDate}
              onChange={(e) => onWeatherDateChange(e.target.value)}
            />
          </IntakeInputField>
        </div>

        {loading && <p className="intake-weather-widget__status">Loading weather…</p>}
        {error && <div className="intake-weather-widget__error">{error}</div>}

        {weather && !loading && (
          <>
            <p className="intake-weather-widget__condition">{conditionLabel}</p>
            <div className="intake-weather-widget__metrics">
              <div className="intake-weather-widget__metric">
                <span className="intake-weather-widget__metric-label">Rain</span>
                <span className="intake-weather-widget__metric-value">
                  {weather.rainProbabilityPercent != null ? `${weather.rainProbabilityPercent}%` : '—'}
                </span>
              </div>
              <div className="intake-weather-widget__metric">
                <span className="intake-weather-widget__metric-label">Wind</span>
                <span className="intake-weather-widget__metric-value">{formatWind(weather)}</span>
              </div>
              <div className="intake-weather-widget__metric">
                <span className="intake-weather-widget__metric-label">Recommendation</span>
                <span className={`intake-weather-widget__metric-value ${suitability ? weatherRecommendationClass(suitability.level) : ''}`}>
                  {suitability?.label || '—'}
                </span>
              </div>
            </div>
          </>
        )}

        {suitability?.reasons?.length > 0 && (
          <ul className="intake-weather-widget__reasons">
            {suitability.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
