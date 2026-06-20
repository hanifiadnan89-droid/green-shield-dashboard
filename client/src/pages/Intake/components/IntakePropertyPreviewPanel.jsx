import { Brain, CloudSun, MapPin, Sparkles } from 'lucide-react';

export default function IntakePropertyPreviewPanel({
  form = {},
  customer = null,
  weather = null,
  suitability = null,
  mapSlot = null,
  treatmentAcreage = null,
  treatmentSquareFeet = null,
}) {
  const source = customer || form;
  const name = [source.firstName, source.lastName].filter(Boolean).join(' ') || 'New customer';
  const address = customer?.verifiedAddress
    || [source.serviceAddress, source.city, source.state, source.zip].filter(Boolean).join(', ')
    || 'Enter an address to preview property intelligence';

  return (
    <aside className="intake-preview-panel">
      <div className="intake-preview-panel__header">
        <Sparkles size={16} />
        <div>
          <p className="intake-preview-panel__eyebrow">Live Property Intelligence</p>
          <h2 className="intake-preview-panel__title">{name}</h2>
        </div>
      </div>

      <div className="intake-preview-panel__map">
        {mapSlot || (
          <div className="intake-preview-panel__map-placeholder">
            <MapPin size={28} />
            <p>Satellite preview</p>
            <span>{address}</span>
          </div>
        )}
      </div>

      <section className="intake-preview-panel__section">
        <h3>Property Overview</h3>
        <dl className="intake-preview-panel__dl">
          <div><dt>Service address</dt><dd>{address}</dd></div>
          <div><dt>Service type</dt><dd>{source.serviceType || '—'}</dd></div>
          <div><dt>Property type</dt><dd>{customer?.propertyUseEstimate || 'Pending'}</dd></div>
          <div><dt>Treatment acreage</dt><dd>{treatmentAcreage != null ? `${treatmentAcreage} ac` : '—'}</dd></div>
          <div><dt>Treatment sq ft</dt><dd>{treatmentSquareFeet != null ? treatmentSquareFeet.toLocaleString('en-US') : '—'}</dd></div>
        </dl>
      </section>

      <section className="intake-preview-panel__section">
        <h3><CloudSun size={14} /> Current Conditions</h3>
        {weather ? (
          <dl className="intake-preview-panel__dl">
            <div><dt>Date</dt><dd>{weather.date || '—'}</dd></div>
            <div><dt>Rain probability</dt><dd>{weather.rainProbabilityPercent ?? '—'}%</dd></div>
            <div><dt>Wind</dt><dd>{weather.windSpeedMph ?? '—'} mph</dd></div>
            <div><dt>Temperature</dt><dd>{weather.temperatureF ?? '—'}°F</dd></div>
          </dl>
        ) : (
          <p className="intake-preview-panel__muted">Weather loads on Property Intelligence.</p>
        )}
      </section>

      <section className="intake-preview-panel__section intake-preview-panel__ai">
        <h3><Brain size={14} /> AI Recommendation</h3>
        <p className="intake-preview-panel__recommendation">
          {suitability?.label || 'Complete intake and property review to generate treatment recommendations.'}
        </p>
        {suitability?.reasons?.length ? (
          <ul className="intake-preview-panel__reasons">
            {suitability.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        ) : null}
      </section>
    </aside>
  );
}
