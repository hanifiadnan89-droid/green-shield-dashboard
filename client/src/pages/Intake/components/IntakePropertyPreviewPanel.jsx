import { CloudSun, MapPin, Sparkles, Target } from 'lucide-react';
import IntakePropertyRecordsSection from './IntakePropertyRecordsSection.jsx';

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

function formatOwnerOccupied(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

function formatBuildingSqFt(value) {
  if (value == null) return null;
  return `${Number(value).toLocaleString('en-US')} sq ft`;
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
  const hasAddress = Boolean(address);
  const isPropertyPage = variant === 'property';
  const hasPolygon = treatmentAcreage != null || boundaryStatus === 'detected' || boundaryStatus === 'drawn';
  const hasRecords = propertyRecordsStatus === 'loaded' && propertyRecords;

  const propertyType = hasRecords
    ? (propertyRecords.propertyType || '—')
    : (source.propertyUseEstimate || 'Residential');
  const propertyTypePending = !hasRecords && !source.propertyUseEstimate;

  const acreageValue = hasRecords
    ? (propertyRecords.lotAcreage || '—')
    : (treatmentAcreage != null ? `${treatmentAcreage} ac` : 'Pending');
  const acreagePending = !hasRecords && treatmentAcreage == null;

  const sqFtValue = hasRecords
    ? (formatBuildingSqFt(propertyRecords.buildingSquareFeet) || '—')
    : (treatmentSquareFeet != null ? treatmentSquareFeet.toLocaleString('en-US') : 'Pending');
  const sqFtPending = !hasRecords && treatmentSquareFeet == null;

  const ownerOccupiedValue = hasRecords
    ? formatOwnerOccupied(propertyRecords.ownerOccupied === null || propertyRecords.ownerOccupied === undefined
      ? null
      : propertyRecords.ownerOccupied)
    : 'Pending';
  const ownerOccupiedPending = !hasRecords;

  const yearBuiltValue = hasRecords
    ? (propertyRecords.yearBuilt ?? '—')
    : 'Pending';
  const yearBuiltPending = !hasRecords;

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
              <InfoCard label="Property Type" value={propertyType} pending={propertyTypePending} />
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
                value={acreageValue}
                pending={acreagePending}
              />
              <InfoCard
                label="Sq Ft"
                value={sqFtValue}
                pending={sqFtPending}
              />
              <InfoCard
                label="Owner Occupied"
                value={ownerOccupiedValue}
                pending={ownerOccupiedPending}
              />
              <InfoCard
                label="Year Built"
                value={yearBuiltValue}
                pending={yearBuiltPending}
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
              </div>
            ) : (
              <PlaceholderBlock
                icon={CloudSun}
                title="Weather data pending"
                detail="Conditions load on Property Intelligence step"
              />
            )}
          </section>

          <IntakePropertyRecordsSection
            customer={customer}
            onRecordsChange={onPropertyRecordsChange}
            loading={propertyRecordsLoading}
            onLoadingChange={onPropertyRecordsLoadingChange}
            error={propertyRecordsError}
            onErrorChange={onPropertyRecordsErrorChange}
            status={propertyRecordsStatus}
            onStatusChange={onPropertyRecordsStatusChange}
          />
        </>
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
