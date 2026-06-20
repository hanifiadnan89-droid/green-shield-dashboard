import {
  AlertTriangle, Brain, CloudSun, Gauge, MapPin, ShieldCheck, Sparkles, Target,
} from 'lucide-react';

function InfoCard({ label, value, pending = false }) {
  return (
    <div className={`intake-info-card${pending ? ' intake-info-card--pending' : ''}`}>
      <p className="intake-info-card__label">{label}</p>
      <p className="intake-info-card__value">{value}</p>
    </div>
  );
}

function PlaceholderBlock({ icon: Icon, title, detail }) {
  return (
    <div className="intake-preview-placeholder">
      <Icon size={18} className="intake-preview-placeholder__icon" />
      <div>
        <p className="intake-preview-placeholder__title">{title}</p>
        <p className="intake-preview-placeholder__detail">{detail}</p>
      </div>
    </div>
  );
}

function boundaryLabel(status) {
  if (status === 'detected') return 'Boundary Detected';
  if (status === 'drawn') return 'Boundary Drawn';
  if (status === 'manual') return 'Draw treatment area';
  return 'Pending';
}

export default function IntakePropertyPreviewPanel({
  form = {},
  customer = null,
  weather = null,
  suitability = null,
  mapSlot = null,
  treatmentAcreage = null,
  treatmentSquareFeet = null,
  boundaryStatus = 'none',
  variant = 'default',
}) {
  const source = customer || form;
  const name = [source.firstName, source.lastName].filter(Boolean).join(' ') || 'New customer';
  const address = customer?.verifiedAddress
    || source.formattedAddress
    || [source.serviceAddress, source.city, source.state, source.zip].filter(Boolean).join(', ')
    || null;
  const hasAddress = Boolean(address);
  const propertyType = source.propertyUseEstimate || null;
  const isPropertyPage = variant === 'property';
  const hasCoords = Number.isFinite(Number(source.latitude)) && Number.isFinite(Number(source.longitude));
  const confidencePct = suitability?.level === 'good' ? 92 : suitability?.level === 'monitor' ? 74 : suitability ? 58 : hasCoords ? 68 : null;
  const hasPolygon = treatmentAcreage != null || boundaryStatus === 'detected' || boundaryStatus === 'drawn';

  return (
    <aside className={`intake-preview-panel${isPropertyPage ? ' intake-preview-panel--property' : ''}`}>
      <div className="intake-preview-panel__header">
        <div className="intake-preview-panel__header-icon">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="intake-preview-panel__eyebrow">Live Property Intelligence</p>
          <h2 className="intake-preview-panel__title">{name}</h2>
        </div>
      </div>

      <div className={`intake-preview-panel__map${isPropertyPage ? ' intake-preview-panel__map--property' : ''}`}>
        {mapSlot || (
          <div className="intake-preview-panel__map-placeholder">
            <div className="intake-preview-panel__map-placeholder-grid" aria-hidden />
            <MapPin size={28} />
            <p>Satellite preview</p>
            <span>{address || 'Enter an address to preview property intelligence'}</span>
          </div>
        )}
      </div>

      {isPropertyPage ? (
        <>
          <section className="intake-preview-panel__section intake-preview-panel__section--compact">
            <h3>Property Overview</h3>
            <div className="intake-info-grid intake-info-grid--single">
              <InfoCard label="Property Type" value={propertyType || 'Residential'} pending={!propertyType} />
              <InfoCard label="Address" value={hasAddress ? address : 'Pending'} pending={!hasAddress} />
            </div>
          </section>

          <section className="intake-preview-panel__section intake-preview-panel__section--compact">
            <h3><Target size={14} /> Treatment Area</h3>
            <div className="intake-info-grid">
              <InfoCard
                label="Boundary"
                value={boundaryLabel(boundaryStatus)}
                pending={!hasPolygon}
              />
              <InfoCard
                label="Acreage"
                value={treatmentAcreage != null ? `${treatmentAcreage} ac` : 'Pending'}
                pending={treatmentAcreage == null}
              />
              <InfoCard
                label="Sq Ft"
                value={treatmentSquareFeet != null ? treatmentSquareFeet.toLocaleString('en-US') : 'Pending'}
                pending={treatmentSquareFeet == null}
              />
            </div>
          </section>

          <section className="intake-preview-panel__section intake-preview-panel__section--compact">
            <h3><CloudSun size={14} /> Current Conditions</h3>
            {weather ? (
              <div className="intake-info-grid intake-info-grid--compact">
                <InfoCard label="Date" value={weather.date || '—'} />
                <InfoCard label="Rain" value={weather.rainProbabilityPercent != null ? `${weather.rainProbabilityPercent}%` : '—'} />
                <InfoCard label="Wind" value={weather.windSpeedMph != null ? `${weather.windSpeedMph} mph` : '—'} />
                <InfoCard label="Temp" value={weather.temperatureF != null ? `${weather.temperatureF}°F` : '—'} />
              </div>
            ) : (
              <PlaceholderBlock
                icon={CloudSun}
                title="Weather data pending"
                detail="Conditions load on Property Intelligence step"
              />
            )}
          </section>
        </>
      ) : (
        <>
          <section className="intake-preview-panel__section">
            <h3>Property Overview</h3>
            <div className="intake-info-grid">
              <InfoCard label="Property Type" value={propertyType || 'Residential'} pending={!propertyType} />
              <InfoCard label="Address" value={hasAddress ? address : 'Pending'} pending={!hasAddress} />
              <InfoCard
                label="Treatment Acreage"
                value={treatmentAcreage != null ? `${treatmentAcreage} ac` : 'Pending'}
                pending={treatmentAcreage == null}
              />
              <InfoCard
                label="Property Confidence"
                value={customer?.propertyConfidence || source.propertyUseConfidence || (hasAddress ? 'Preliminary' : 'Pending')}
                pending={!customer?.propertyConfidence && !source.propertyUseConfidence && !hasAddress}
              />
            </div>
          </section>

          <section className="intake-preview-panel__section">
            <h3><Target size={14} /> Treatment Area Status</h3>
            <div className="intake-info-grid intake-info-grid--compact">
              <InfoCard
                label="Boundary"
                value={boundaryLabel(boundaryStatus)}
                pending={!hasPolygon}
              />
              <InfoCard
                label="Sq Ft"
                value={treatmentSquareFeet != null ? treatmentSquareFeet.toLocaleString('en-US') : 'Pending'}
                pending={treatmentSquareFeet == null}
              />
            </div>
          </section>

          <section className="intake-preview-panel__section">
            <h3><CloudSun size={14} /> Current Conditions</h3>
            {weather ? (
              <div className="intake-info-grid intake-info-grid--compact">
                <InfoCard label="Date" value={weather.date || '—'} />
                <InfoCard label="Rain" value={weather.rainProbabilityPercent != null ? `${weather.rainProbabilityPercent}%` : '—'} />
                <InfoCard label="Wind" value={weather.windSpeedMph != null ? `${weather.windSpeedMph} mph` : '—'} />
                <InfoCard label="Temp" value={weather.temperatureF != null ? `${weather.temperatureF}°F` : '—'} />
              </div>
            ) : (
              <PlaceholderBlock
                icon={CloudSun}
                title="Weather data pending"
                detail="Conditions load on Property Intelligence step"
              />
            )}
          </section>

          <section className="intake-preview-panel__section intake-preview-panel__ai">
            <div className="intake-preview-panel__ai-header">
              <Brain size={16} />
              <div>
                <p className="intake-preview-panel__ai-brand">Green Shield Intelligence™</p>
                <p className="intake-preview-panel__ai-sub">Recommended Service</p>
              </div>
              {suitability?.level && (
                <span className="intake-preview-panel__confidence">
                  {suitability.level === 'good' ? 92 : suitability.level === 'monitor' ? 74 : 58}%
                </span>
              )}
            </div>
            <p className="intake-preview-panel__recommendation">
              {suitability?.label || source.serviceType || 'Complete intake to generate treatment recommendations.'}
            </p>
            {suitability?.reasons?.length ? (
              <ul className="intake-preview-panel__reasons">
                {suitability.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            ) : (
              <ul className="intake-preview-panel__reasons intake-preview-panel__reasons--placeholder">
                <li>Address validation confirms service territory</li>
                <li>Property type informs treatment protocol</li>
                <li>Weather suitability evaluated before scheduling</li>
              </ul>
            )}
            <span className={`intake-preview-panel__status-badge intake-preview-panel__status-badge--${suitability?.level || 'pending'}`}>
              {suitability?.label ? 'Analysis complete' : hasCoords ? 'Address captured' : 'Awaiting data'}
            </span>
          </section>

          <div className="intake-preview-panel__meta-row">
            <div className="intake-preview-meta intake-preview-meta--status">
              <ShieldCheck size={14} />
              <span>Property Status: {hasAddress ? 'Active lead' : 'Draft'}</span>
            </div>
            <div className="intake-preview-meta intake-preview-meta--risk">
              <AlertTriangle size={14} />
              <span>Risk: {suitability?.level === 'not_recommended' ? 'Monitor' : 'Low'}</span>
            </div>
            {confidencePct != null && (
              <div className="intake-preview-meta intake-preview-meta--score">
                <Gauge size={14} />
                <span>Confidence: {confidencePct}%</span>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
