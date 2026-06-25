import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ExternalLink, MapPin } from 'lucide-react';
import PropertyMap from './components/PropertyMap.jsx';
import IntakePageHeader from './components/IntakePageHeader.jsx';
import IntakeKpiBar from './components/IntakeKpiBar.jsx';
import IntakeProgressTracker from './components/IntakeProgressTracker.jsx';
import IntakeStatusCards from './components/IntakeStatusCards.jsx';
import IntakePropertyPreviewPanel from './components/IntakePropertyPreviewPanel.jsx';
import IntakeWeatherWidget from './components/IntakeWeatherWidget.jsx';
import IntakePageShell from './components/IntakePageShell.jsx';
import ObjectionAssistant from './components/ObjectionAssistant.jsx';
import { api } from '../../api/client.js';
import {
  loadIntakeSession,
  updateIntakeProperty,
} from '../../utils/intake/intakeSession.js';
import { buildLeadFromIntakeSession } from '../../utils/intake/buildIntakeLead.js';
import { evaluateWeatherSuitability } from '../../utils/intake/weatherSuitability.js';
import { formatAcreage, formatSquareFeet } from '../../utils/intake/polygonArea.js';
import { formatDisplayAddress } from '../../utils/intake/formatDisplayAddress.js';
import { buildZillowSearchUrl } from '../../utils/intake/buildZillowSearchUrl.js';
import './intake.css';

function getPricingHint(serviceType) {
  if (!serviceType) return null;
  const st = serviceType.toLowerCase();
  if (st.includes('tick') || st.includes('mosquito') || st === 't/m' || st === 'tm') {
    return '$119/month — Tick & Mosquito Monthly, May–October';
  }
  if (st.includes('quarterly') || st === 'iq') {
    return '$119/quarter — Integrated Quarterly, year-round';
  }
  return null;
}

export default function IntakePropertyPage() {
  const navigate = useNavigate();
  const session = useMemo(() => loadIntakeSession(), []);
  const customer = session.customer;

  const [mapType, setMapType] = useState('satellite');
  const [enable3d, setEnable3d] = useState(false);
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
  const [propertyRecords, setPropertyRecords] = useState(session.property?.propertyRecords || null);
  const [propertyRecordsLoading, setPropertyRecordsLoading] = useState(false);
  const [propertyRecordsError, setPropertyRecordsError] = useState(null);
  const [propertyRecordsStatus, setPropertyRecordsStatus] = useState(
    session.property?.propertyRecords ? 'loaded' : 'idle',
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
      propertyRecords,
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

  const zillowUrl = customer ? buildZillowSearchUrl(customer) : null;

  const mapSlot = (
    <div className="intake-property-map-slot">
      <PropertyMap
        center={center}
        polygonPath={treatmentPolygon}
        mapType={mapType}
        onMapTypeChange={setMapType}
        enable3d={enable3d}
        onEnable3dChange={setEnable3d}
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

      {/* Action row: Zillow + Back + Continue */}
      <div className="intake-property-action-row">
        {zillowUrl && (
          <a
            href={zillowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="intake-zillow-link"
          >
            View on Zillow
            <ExternalLink size={12} aria-hidden />
          </a>
        )}
        <button
          type="button"
          className="intake-property-action-row__back"
          onClick={() => navigate('/intake')}
        >
          Back
        </button>
        <button
          type="button"
          className="intake-property-action-row__continue"
          onClick={handleContinue}
        >
          Continue to Send Template
          <ArrowRight size={12} />
        </button>
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

                <IntakeStatusCards
                  form={customer}
                  verified
                  propertyRecordsStatus={propertyRecordsStatus}
                />

                <div className="intake-property-objection-slot">
                  <ObjectionAssistant
                    context={{
                      customerName:        [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null,
                      serviceType:         customer.serviceType || customer.serviceTypeCode || null,
                      address:             customer.verifiedAddress || null,
                      weather:             weather || null,
                      suitability:         suitability || null,
                      treatmentAcreage,
                      treatmentSquareFeet,
                      propertyType:        customer.propertyUseEstimate || null,
                      pricing:             getPricingHint(customer.serviceType || customer.serviceTypeCode),
                      leadNotes:           session.property?.salesNotes || session.property?.propertyNotes || null,
                      previousMessage:     null,
                      recommendations:     session.property?.intelligenceNotes || null,
                    }}
                  />
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
                propertyRecords={propertyRecords}
                onPropertyRecordsChange={setPropertyRecords}
                propertyRecordsLoading={propertyRecordsLoading}
                onPropertyRecordsLoadingChange={setPropertyRecordsLoading}
                propertyRecordsError={propertyRecordsError}
                onPropertyRecordsErrorChange={setPropertyRecordsError}
                propertyRecordsStatus={propertyRecordsStatus}
                onPropertyRecordsStatusChange={setPropertyRecordsStatus}
                mapSlot={mapSlot}
              />
          </div>
        </motion.div>
    </IntakePageShell>
  );
}
