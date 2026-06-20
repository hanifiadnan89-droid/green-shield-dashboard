import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CloudSun, MapPin } from 'lucide-react';
import PropertyMap from './components/PropertyMap.jsx';
import IntakePageHeader from './components/IntakePageHeader.jsx';
import IntakeKpiBar from './components/IntakeKpiBar.jsx';
import IntakeProgressTracker from './components/IntakeProgressTracker.jsx';
import IntakeInputField from './components/IntakeInputField.jsx';
import IntakeStatusCards from './components/IntakeStatusCards.jsx';
import IntakeWorkflowNextCard from './components/IntakeWorkflowNextCard.jsx';
import IntakePropertyPreviewPanel from './components/IntakePropertyPreviewPanel.jsx';
import IntakePageShell from './components/IntakePageShell.jsx';
import { api } from '../../api/client.js';
import {
  loadIntakeSession,
  updateIntakeProperty,
} from '../../utils/intake/intakeSession.js';
import { buildLeadFromIntakeSession } from '../../utils/intake/buildIntakeLead.js';
import { evaluateWeatherSuitability } from '../../utils/intake/weatherSuitability.js';
import { formatAcreage, formatSquareFeet } from '../../utils/intake/polygonArea.js';
import './intake.css';

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
  const [boundaryStatus, setBoundaryStatus] = useState(
    session.property?.treatmentPolygon?.length >= 3 ? 'drawn' : 'none',
  );

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
        if (!cancelled && data) setWeather(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.httpStatus === 304) {
          setWeather((prev) => prev || session.property?.weather || null);
          return;
        }
        setWeatherError(err.message);
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });

    return () => { cancelled = true; };
  }, [customer?.latitude, customer?.longitude, weatherDate, session.property?.weather]);

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

  const mapSlot = (
    <div>
      <div className="intake-map-toolbar">
        <button type="button" className={`intake-map-btn ${mapType === 'satellite' ? 'intake-map-btn--active' : ''}`} onClick={() => setMapType('satellite')}>
          Satellite
        </button>
        <button type="button" className={`intake-map-btn ${mapType === 'roadmap' ? 'intake-map-btn--active' : ''}`} onClick={() => setMapType('roadmap')}>
          Map
        </button>
      </div>
      <PropertyMap
        center={center}
        polygonPath={treatmentPolygon}
        suggestedBoundary={customer.suggestedTreatmentPolygon || []}
        mapType={mapType}
        onPolygonChange={setTreatmentPolygon}
        onAreaChange={handleAreaChange}
        onBoundaryStatusChange={setBoundaryStatus}
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
    </div>
  );

  return (
    <IntakePageShell>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <IntakePageHeader
            title="Property Intelligence"
            subtitle="Review the property, draw the treatment area, and check weather suitability before sending the agreement."
            continueType="button"
            onContinueClick={handleContinue}
            continueLabel={<>Continue to Send Template <ArrowRight size={14} /></>}
          />

          <IntakeKpiBar form={customer} verified />

          <IntakeProgressTracker currentStep={2} />

            <div className="intake-workspace__columns">
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

                <section className="intake-card space-y-4">
                  <h2 className="intake-card__title flex items-center gap-2"><CloudSun size={16} /> Weather Suitability</h2>
                  <p className="intake-card__subtitle">Recommendations only — does not block scheduling.</p>

                  <div className="flex flex-wrap items-end gap-3">
                    <IntakeInputField id="weatherDate" label="Service Date">
                      <input id="weatherDate" type="date" className="intake-input" value={weatherDate} onChange={(e) => setWeatherDate(e.target.value)} />
                    </IntakeInputField>
                    {suitability && (
                      <span className={weatherPillClass(suitability.level)}>
                        {suitability.label}
                      </span>
                    )}
                  </div>

                  {weatherLoading && <p className="text-sm text-slate-500">Loading weather…</p>}
                  {weatherError && <div className="intake-error">{weatherError}</div>}
                  {suitability?.reasons?.length > 0 && (
                    <ul className="text-sm text-slate-500 list-disc pl-5 space-y-1">
                      {suitability.reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  )}
                </section>

                <section className="intake-card space-y-4">
                  <h2 className="intake-card__title">Notes</h2>
                  <IntakeInputField id="propertyNotes" label="Property Notes" multiline>
                    <textarea id="propertyNotes" className="intake-input resize-none" rows={2} value={propertyNotes} onChange={(e) => setPropertyNotes(e.target.value)} />
                  </IntakeInputField>
                  <IntakeInputField id="salesNotes" label="Sales Notes" multiline>
                    <textarea id="salesNotes" className="intake-input resize-none" rows={2} value={salesNotes} onChange={(e) => setSalesNotes(e.target.value)} />
                  </IntakeInputField>
                  <IntakeInputField id="intelligenceNotes" label="Intelligence Notes" multiline>
                    <textarea id="intelligenceNotes" className="intake-input resize-none" rows={2} value={intelligenceNotes} onChange={(e) => setIntelligenceNotes(e.target.value)} />
                  </IntakeInputField>
                </section>

                <IntakeStatusCards form={customer} verified />
                <IntakeWorkflowNextCard />

                <div className="intake-actions">
                  <button type="button" className="intake-secondary-btn" onClick={() => navigate('/intake')}>
                    Back
                  </button>
                  <button type="button" className="intake-primary-btn lg:hidden" onClick={handleContinue}>
                    Continue to Send Template <ArrowRight size={14} className="inline ml-1" />
                  </button>
                </div>
              </div>

              <IntakePropertyPreviewPanel
                customer={customer}
                weather={weather}
                suitability={suitability}
                treatmentAcreage={treatmentAcreage}
                treatmentSquareFeet={treatmentSquareFeet}
                boundaryStatus={boundaryStatus}
                mapSlot={mapSlot}
              />
          </div>
        </motion.div>
    </IntakePageShell>
  );
}
