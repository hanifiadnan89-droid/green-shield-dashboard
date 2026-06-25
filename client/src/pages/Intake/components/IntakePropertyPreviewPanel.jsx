import { MapPin, Sparkles } from 'lucide-react';

function InfoCard({ label, value, pending = false }) {
  return (
    <div className={`intake-info-card${pending ? ' intake-info-card--pending' : ''}`}>
      <p className="intake-info-card__label">{label}</p>
      <p className="intake-info-card__value">{value}</p>
    </div>
  );
}

export default function IntakePropertyPreviewPanel({
  form = {},
  customer = null,
  mapSlot = null,
  variant = 'default',
  // kept in signature for backward-compat; no longer rendered in property view
  weather,
  suitability,
  treatmentAcreage,
  treatmentSquareFeet,
  boundaryStatus,
  propertyRecords,
  onPropertyRecordsChange,
  propertyRecordsStatus,
  onPropertyRecordsStatusChange,
  propertyRecordsLoading,
  onPropertyRecordsLoadingChange,
  propertyRecordsError,
  onPropertyRecordsErrorChange,
}) {
  const source = customer || form;
  const name = [source.firstName, source.lastName].filter(Boolean).join(' ') || 'New customer';
  const address = customer?.verifiedAddress
    || source.formattedAddress
    || [source.serviceAddress, source.city, source.state, source.zip].filter(Boolean).join(', ')
    || null;
  const streetAddress = source.serviceAddress || null;
  const city = source.city || null;
  const state = source.state || null;
  const zip = source.zip || null;
  const isPropertyPage = variant === 'property';

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

      {!isPropertyPage && (
        <section className="intake-preview-panel__section intake-preview-panel__section--overview">
          <h3>Property Overview</h3>
          <div className="intake-info-grid intake-info-grid--address">
            <InfoCard label="Property Type" value={source.propertyUseEstimate || 'Residential'} pending={!source.propertyUseEstimate} />
            <InfoCard label="Address" value={streetAddress || 'Pending'} pending={!streetAddress} />
            <InfoCard label="City" value={city || 'Pending'} pending={!city} />
            <InfoCard label="State" value={state || 'Pending'} pending={!state} />
            <InfoCard label="Zip Code" value={zip || 'Pending'} pending={!zip} />
          </div>
        </section>
      )}
    </aside>
  );
}
