import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, MapPin } from 'lucide-react';
import PropertyMap from './components/PropertyMap.jsx';
import IntakePageHeader from './components/IntakePageHeader.jsx';
import IntakeKpiBar from './components/IntakeKpiBar.jsx';
import IntakeProgressTracker from './components/IntakeProgressTracker.jsx';
import IntakeStatusCards from './components/IntakeStatusCards.jsx';
import IntakePropertyPreviewPanel from './components/IntakePropertyPreviewPanel.jsx';
import IntakeWeatherWidget from './components/IntakeWeatherWidget.jsx';
import IntakePageShell from './components/IntakePageShell.jsx';
import { api } from '../../api/client.js';
import {
  loadIntakeSession,
  updateIntakeProperty,
} from '../../utils/intake/intakeSession.js';
import { buildLeadFromIntakeSession } from '../../utils/intake/buildIntakeLead.js';
import { evaluateWeatherSuitability } from '../../utils/intake/weatherSuitability.js';
import { formatAcreage, formatSquareFeet } from '../../utils/intake/polygonArea.js';
import { formatDisplayAddress } from '../../utils/intake/formatDisplayAddress.js';
import './intake.css';

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
    <div className="intake-property-map-slot">
      <div className="intake-map-toolbar intake-map-toolbar--type">
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
        mapType={mapType}
        onPolygonChange={setTreatmentPolygon}
        onAreaChange={handleAreaChange}
        onBoundaryStatusChange={setBoundaryStatus}
      />
      <div className="intake-stat-grid intake-stat-grid--treatment mt-4">
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
                <section className="intake-card intake-card--address">
                  <h2 className="intake-card__title flex items-center gap-2"><MapPin size={16} /> Verified Address</h2>
                  <p className="intake-address-display">{formatDisplayAddress(customer.verifiedAddress)}</p>
                </section>

                <IntakeWeatherWidget
                  weatherDate={weatherDate}
                  onWeatherDateChange={setWeatherDate}
                  weather={weather}
                  suitability={suitability}
                  loading={weatherLoading}
                  error={weatherError}
                />

                <IntakeStatusCards form={customer} verified />

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
                variant="property"
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
