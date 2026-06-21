import { Building2, FileText } from 'lucide-react';

function RecordField({ label, value, pending = false }) {
  return (
    <div className={`intake-property-records__field${pending ? ' intake-property-records__field--pending' : ''}`}>
      <span className="intake-property-records__field-label">{label}</span>
      <span className="intake-property-records__field-value">{value}</span>
    </div>
  );
}

function formatSqft(value) {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('en-US')} sq ft`;
}

function formatOwnerOccupied(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

export default function IntakePropertyRecordsPanel({
  records = null,
  loading = false,
  error = null,
  status = 'idle',
  bedsBaths = null,
  compact = false,
}) {
  if (loading) {
    return (
      <div className="intake-property-records__panel intake-property-records__panel--loading">
        <Building2 size={18} />
        <p>Fetching property records…</p>
      </div>
    );
  }

  if (status === 'unavailable' || error) {
    return (
      <div className="intake-property-records__panel intake-property-records__panel--empty">
        <p className="intake-property-records__empty-title">Property records unavailable</p>
        <p className="intake-property-records__empty-detail">
          {error || 'No RentCast records were found for this address. You can continue intake normally.'}
        </p>
      </div>
    );
  }

  if (!records) {
    return (
      <div className="intake-property-records__panel intake-property-records__panel--idle">
        <Building2 size={18} />
        <p>Click <strong>Lookup Property Records</strong> to load structure, lot, and ownership details.</p>
      </div>
    );
  }

  const lotLabel = records.lotAcreage
    ? `${records.lotAcreage} (${formatSqft(records.lotSizeSquareFeet)})`
    : formatSqft(records.lotSizeSquareFeet);

  return (
    <div className={`intake-property-records__panel${compact ? ' intake-property-records__panel--compact' : ''}`}>
      <div className="intake-property-records__grid">
        <RecordField label="Property type" value={records.propertyType || '—'} />
        <RecordField label="Year built" value={records.yearBuilt ?? '—'} />
        <RecordField label="Building sq ft" value={formatSqft(records.buildingSquareFeet)} />
        <RecordField label="Lot size" value={lotLabel} />
        {bedsBaths && <RecordField label="Bedrooms / baths" value={bedsBaths} />}
        <RecordField label="Owner occupied" value={formatOwnerOccupied(records.ownerOccupied)} />
        <RecordField label="Last sale date" value={records.lastSaleDate || '—'} />
        <RecordField label="Last sale price" value={records.lastSalePriceLabel || '—'} />
        <RecordField label="Estimated value" value={records.estimatedValueLabel || '—'} pending={!records.estimatedValueLabel} />
        <RecordField label="Tax assessed value" value={records.taxAssessedValueLabel || '—'} />
      </div>

      {!compact && records.salesNotes?.length > 0 && (
        <div className="intake-property-records__notes">
          <div className="intake-property-records__notes-header">
            <FileText size={14} />
            <span>Sales notes</span>
          </div>
          <ul>
            {records.salesNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {records.cached && !compact && (
        <p className="intake-property-records__cache-note">Loaded from server cache — no additional API call used.</p>
      )}
    </div>
  );
}
