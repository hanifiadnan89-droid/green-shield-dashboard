import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CloudSun, MapPin, Satellite } from 'lucide-react';
import LeadsAmbientBackground from '../Leads/LeadsAmbientBackground.jsx';
import PropertyMap from './components/PropertyMap.jsx';
import { api } from '../../api/client.js';
import {
  loadIntakeSession,
  updateIntakeProperty,
} from '../../utils/intake/intakeSession.js';
import { buildLeadFromIntakeSession } from '../../utils/intake/buildIntakeLead.js';
import { evaluateWeatherSuitability } from '../../utils/intake/weatherSuitability.js';
import { formatAcreage, formatSquareFeet } from '../../utils/intake/polygonArea.js';
import './intake.css';

function IntakeStepper({ step }) {
  const steps = [
    { n: 1, label: 'Customer Intake' },
    { n: 2, label: 'Property Intelligence' },
  ];

  return (
    <div className="intake-stepper">
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="intake-stepper__step">
            <span className={`intake-stepper__dot ${active ? 'intake-stepper__dot--active' : done ? 'intake-stepper__dot--done' : 'intake-stepper__dot--pending'}`}>
              {s.n}
            </span>
            <span className={active ? 'text-gs-text font-medium' : 'text-gs-muted'}>{s.label}</span>
            {i < steps.length - 1 && <span className="text-gs-muted mx-1">→</span>}
          </div>
        );
      })}
    </div>
  );
}

function weatherPillClass(level) {
  if (level === 'good') return 'intake-weather-pill intake-weather-pill--good';
  if (level === 'monitor') return 'intake-weather-pill intake-weather-pill--monitor';
  return 'intake-weather-pill intake-weather-pill--not_recommended';
}

export default function IntakePropertyPage() {
  const navigate = useNavigate();
  const session = useMemo(() => loadIntakeSession(), []);
  const customer = session.customer;

  const [mapType, setMapType] = useState('satellite');
  const [treatmentPolygon, setTreatmentPolygon] = useState(session.property?.treatmentPolygon || []);
  const [treatmentAcreage, setTreatmentAcreage] = useState(session.property?.treatmentAcreage ?? null);
  const [treatmentSquareFeet, setTreatmentSquareFeet] = useState(session.property?.treatmentSquareFeet ?? null);
  const [propertyNotes, setPropertyNotes] = useState(session.property?.propertyNotes || '');
  const [salesNotes, setSalesNotes] = useState(session.property?.salesNotes || '');
  const [intelligenceNotes, setIntelligenceNotes] = useState(session.property?.intelligenceNotes || '');
  const [weatherDate, setWeatherDate] = useState(session.property?.weatherDate || new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState(session.property?.weather || null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);

  useEffect(() => {
    if (!customer) {
      navigate('/intake', { replace: true });
    }
  }, [customer, navigate]);

  const suitability = useMemo(
    () => (weather ? evaluateWeatherSuitability(weather) : null),
    [weather],
  );

  useEffect(() => {
    if (!customer?.latitude || !customer?.longitude || !weatherDate) return undefined;

    let cancelled = false;
    setWeatherLoading(true);
    setWeatherError(null);

    api.intake.weather({
      date: weatherDate,
      lat: customer.latitude,
      lng: customer.longitude,
    })
      .then(({ weather: data }) => {
        if (!cancelled) setWeather(data);
      })
      .catch((err) => {
        if (!cancelled) setWeatherError(err.message);
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });

    return () => { cancelled = true; };
  }, [customer?.latitude, customer?.longitude, weatherDate]);

  if (!customer) return null;

  const center = { lat: customer.latitude, lng: customer.longitude };

  function handleAreaChange(area) {
    setTreatmentAcreage(area.treatmentAcreage);
    setTreatmentSquareFeet(area.treatmentSquareFeet);
  }

  function handleContinue() {
    const property = {
      verifiedAddress: customer.verifiedAddress,
      latitude: customer.latitude,
      longitude: customer.longitude,
      propertyUseEstimate: customer.propertyUseEstimate,
      propertyConfidence: customer.propertyConfidence,
      treatmentPolygon,
      treatmentAcreage,
      treatmentSquareFeet,
      propertyNotes,
      salesNotes,
      intelligenceNotes,
      weatherDate,
      weather,
      weatherSuitability: suitability,
    };

    const nextSession = updateIntakeProperty(property);
    const lead = buildLeadFromIntakeSession(nextSession);

    navigate('/send', {
      state: {
        lead,
        fromIntake: true,
        intake: nextSession,
      },
    });
  }

  return (
    <div className="intake-page">
      <LeadsAmbientBackground />
      <div className="intake-page__inner max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Satellite size={20} className="text-gs-accent" />
            <h1 className="text-xl font-bold text-white">Property Intelligence</h1>
          </div>
          <p className="text-sm text-gs-muted mb-4">Review the property, draw treatment area, and check weather suitability.</p>

          <IntakeStepper step={2} />

          <div className="space-y-5">
            <section className="intake-card">
              <h2 className="intake-card__title flex items-center gap-2"><MapPin size={16} /> Verified Address</h2>
              <div className="intake-stat-grid mt-4">
                <div className="intake-stat sm:col-span-2">
                  <p className="intake-stat__label">Address</p>
                  <p className="intake-stat__value">{customer.verifiedAddress}</p>
                </div>
                <div className="intake-stat">
                  <p className="intake-stat__label">Latitude</p>
                  <p className="intake-stat__value">{customer.latitude}</p>
                </div>
                <div className="intake-stat">
                  <p className="intake-stat__label">Longitude</p>
                  <p className="intake-stat__value">{customer.longitude}</p>
                </div>
                <div className="intake-stat">
                  <p className="intake-stat__label">Property Type Estimate</p>
                  <p className="intake-stat__value">{customer.propertyUseEstimate || 'Unknown'}</p>
                </div>
                <div className="intake-stat">
                  <p className="intake-stat__label">Property Confidence</p>
                  <p className="intake-stat__value capitalize">{customer.propertyConfidence || '—'}</p>
                </div>
              </div>
            </section>

            <section className="intake-card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="intake-card__title">Treatment Area Map</h2>
                <div className="flex gap-2">
                  <button type="button" className={`intake-map-btn ${mapType === 'satellite' ? 'intake-map-btn--active' : ''}`} onClick={() => setMapType('satellite')}>
                    Satellite
                  </button>
                  <button type="button" className={`intake-map-btn ${mapType === 'roadmap' ? 'intake-map-btn--active' : ''}`} onClick={() => setMapType('roadmap')}>
                    Map
                  </button>
                </div>
              </div>

              <PropertyMap
                center={center}
                polygonPath={treatmentPolygon}
                mapType={mapType}
                onPolygonChange={setTreatmentPolygon}
                onAreaChange={handleAreaChange}
              />

              <div className="intake-stat-grid mt-4">
                <div className="intake-stat">
                  <p className="intake-stat__label">Estimated Treatment Acreage</p>
                  <p className="intake-stat__value">{treatmentAcreage != null ? formatAcreage(treatmentAcreage) : '—'} acres</p>
                </div>
                <div className="intake-stat">
                  <p className="intake-stat__label">Estimated Treatment Square Footage</p>
                  <p className="intake-stat__value">{treatmentSquareFeet != null ? formatSquareFeet(treatmentSquareFeet) : '—'} sq ft</p>
                </div>
              </div>
            </section>

            <section className="intake-card space-y-4">
              <h2 className="intake-card__title flex items-center gap-2"><CloudSun size={16} /> Weather Suitability</h2>
              <p className="intake-card__subtitle">Recommendations only — does not block scheduling.</p>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="intake-label" htmlFor="weatherDate">Service Date</label>
                  <input id="weatherDate" type="date" className="intake-input" value={weatherDate} onChange={(e) => setWeatherDate(e.target.value)} />
                </div>
                {suitability && (
                  <span className={weatherPillClass(suitability.level)}>
                    {suitability.label}
                  </span>
                )}
              </div>

              {weatherLoading && <p className="text-sm text-gs-muted">Loading weather…</p>}
              {weatherError && <div className="intake-error">{weatherError}</div>}
              {suitability?.reasons?.length > 0 && (
                <ul className="text-sm text-gs-muted list-disc pl-5 space-y-1">
                  {suitability.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
            </section>

            <section className="intake-card space-y-4">
              <h2 className="intake-card__title">Notes</h2>
              <div>
                <label className="intake-label" htmlFor="propertyNotes">Property Notes</label>
                <textarea id="propertyNotes" className="intake-input resize-none" rows={2} value={propertyNotes} onChange={(e) => setPropertyNotes(e.target.value)} />
              </div>
              <div>
                <label className="intake-label" htmlFor="salesNotes">Sales Notes</label>
                <textarea id="salesNotes" className="intake-input resize-none" rows={2} value={salesNotes} onChange={(e) => setSalesNotes(e.target.value)} />
              </div>
              <div>
                <label className="intake-label" htmlFor="intelligenceNotes">Intelligence Notes</label>
                <textarea id="intelligenceNotes" className="intake-input resize-none" rows={2} value={intelligenceNotes} onChange={(e) => setIntelligenceNotes(e.target.value)} />
              </div>
            </section>

            <div className="intake-actions">
              <button type="button" className="intake-secondary-btn" onClick={() => navigate('/intake')}>
                Back
              </button>
              <button type="button" className="intake-primary-btn" onClick={handleContinue}>
                Continue to Send Template <ArrowRight size={14} className="inline ml-1" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
