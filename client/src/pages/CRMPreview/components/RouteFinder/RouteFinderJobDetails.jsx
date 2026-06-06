import {
  ROUTE_SERVICE_TYPES,
  CUSTOM_DURATION_ID,
  DURATION_MIN_LIMIT,
  DURATION_MAX_LIMIT,
  getServiceTypeById,
} from './routeServiceTypes.js';

export default function RouteFinderJobDetails({
  isPage,
  serviceTypeId,
  onServiceTypeChange,
  customDurationMinutes,
  onCustomDurationChange,
  customerName,
  onCustomerNameChange,
  notes,
  onNotesChange,
  callAheadRequired,
  onCallAheadChange,
  validationErrors = [],
}) {
  const selectedType = getServiceTypeById(serviceTypeId);
  const showCustom = serviceTypeId === CUSTOM_DURATION_ID;

  return (
    <div className="rf-job-details">
      <label className={isPage ? 'rf-section-label' : 'type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-1.5'}>
        Job Details
      </label>

      <div className="rf-job-details__grid">
        <div className="rf-job-field">
          <label className="rf-job-field__label" htmlFor="rf-service-type">Service type</label>
          <select
            id="rf-service-type"
            value={serviceTypeId}
            onChange={e => onServiceTypeChange(e.target.value)}
            className="rf-job-field__select"
          >
            <option value="">Select service…</option>
            {ROUTE_SERVICE_TYPES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {selectedType?.notes && (
            <p className="rf-job-field__hint">{selectedType.notes}</p>
          )}
        </div>

        {showCustom && (
          <div className="rf-job-field">
            <label className="rf-job-field__label" htmlFor="rf-custom-duration">
              Custom duration (minutes)
            </label>
            <input
              id="rf-custom-duration"
              type="number"
              min={DURATION_MIN_LIMIT}
              max={DURATION_MAX_LIMIT}
              value={customDurationMinutes}
              onChange={e => onCustomDurationChange(e.target.value)}
              className="rf-job-field__input"
              placeholder={`${DURATION_MIN_LIMIT}–${DURATION_MAX_LIMIT}`}
            />
          </div>
        )}

        {!showCustom && selectedType && (
          <div className="rf-job-field rf-job-field--duration">
            <span className="rf-job-field__label">Duration</span>
            <span className="rf-job-duration-badge">
              {selectedType.defaultDurationMinutes} min
              <span className="rf-job-duration-badge__conf">{selectedType.durationConfidence}</span>
            </span>
          </div>
        )}

        <div className="rf-job-field">
          <label className="rf-job-field__label" htmlFor="rf-customer-name">
            Customer name <span className="rf-job-optional">optional</span>
          </label>
          <input
            id="rf-customer-name"
            type="text"
            value={customerName}
            onChange={e => onCustomerNameChange(e.target.value)}
            className="rf-job-field__input"
            placeholder="e.g. Jane Smith"
          />
        </div>

        <div className="rf-job-field rf-job-field--full">
          <label className="rf-job-field__label" htmlFor="rf-notes">
            Notes <span className="rf-job-optional">optional</span>
          </label>
          <textarea
            id="rf-notes"
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            className="rf-job-field__textarea"
            rows={2}
            placeholder="Access instructions, pets, landlord details…"
          />
        </div>

        <label className="rf-job-checkbox">
          <input
            type="checkbox"
            checked={callAheadRequired}
            onChange={e => onCallAheadChange(e.target.checked)}
          />
          <span>Customer needs a call-ahead</span>
        </label>
      </div>

      {validationErrors.length > 0 && (
        <ul className="rf-job-validation" role="alert">
          {validationErrors.map(msg => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
