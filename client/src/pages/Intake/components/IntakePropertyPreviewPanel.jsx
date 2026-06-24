import { MapPin, Sparkles } from 'lucide-react';
import ObjectionAssistant from './ObjectionAssistant.jsx';

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
  weather = null,
  suitability = null,
  mapSlot = null,
  treatmentAcreage = null,
  treatmentSquareFeet = null,
  boundaryStatus = 'none',
  propertyRecords = null,
  onPropertyRecordsChange,
  propertyRecordsStatus = 'idle',
  onPropertyRecordsStatusChange,
  propertyRecordsLoading = false,
  onPropertyRecordsLoadingChange,
  propertyRecordsError = null,
  onPropertyRecordsErrorChange,
  variant = 'default',
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

  const hasRecords = propertyRecordsStatus === 'loaded' && propertyRecords;
  const propertyType = hasRecords
    ? (propertyRecords.propertyType || null)
    : (source.propertyUseEstimate || null);

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
        <ObjectionAssistant
          context={{
            customerName:        name || null,
            serviceType:         source.serviceType || source.serviceTypeCode || null,
            address:             address || null,
            weather:             weather || null,
            suitability:         suitability || null,
            treatmentAcreage:    treatmentAcreage,
            treatmentSquareFeet: treatmentSquareFeet,
            propertyType:        propertyType,
            yearBuilt:           hasRecords ? (propertyRecords.yearBuilt || null) : null,
          }}
        />
      ) : (
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
