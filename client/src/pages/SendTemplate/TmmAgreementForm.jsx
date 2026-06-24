import { RotateCcw } from 'lucide-react';
import { formatMoney, computeFinalQuote } from './previewSendUtils.js';

export const TMM_SERVICE_DETAILS_DEFAULT =
  'Green Shield tick and mosquito service is a seasonal exterior program focused on lawn edges, ornamental plantings, shrubs, landscaping, and perimeter vegetation. Treatments target tick harborage along wooded edges and mosquito resting and breeding zones so you can enjoy your yard during the active season. Service is performed monthly during the seasonal program below, and visits are billed per treatment after each service.';

const CUSTOMER_FIELDS = [
  ['name',  'Customer name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
];

const ADDRESS_FIELDS = [
  ['street', 'Address', 'full'],
  ['city',   'City'],
  ['state',  'State'],
  ['zip',    'Zip'],
];

const PRICING_FIELDS = [
  ['initial',    'Initial quote'],
  ['discounted', 'Discount'],
  ['recurring',  'Recurring / mo'],
];

export default function TmmAgreementForm({ form, onChange, onReset, previewStale }) {
  function set(key, value) {
    onChange({ ...form, [key]: value });
  }

  const pricing = {
    initial: form.initial,
    discounted: form.discounted,
    recurring: form.recurring,
  };

  const isServiceDetailsOverridden = form.serviceDetailsText !== null;

  return (
    <div className="send-bedbug-form space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="send-preview-pricing-edit__title mb-0">T&M Agreement Editor</p>
        <div className="flex items-center gap-2">
          {previewStale && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gs-warn">
              Preview stale
            </span>
          )}
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gs-muted hover:text-gs-text transition-colors"
            title="Reset all fields to lead defaults"
          >
            <RotateCcw size={10} />
            Reset
          </button>
        </div>
      </div>

      {/* Customer */}
      <div className="send-preview-address">
        <p className="send-preview-address__title">Customer</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CUSTOMER_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted mb-1 block">
                {label}
              </label>
              <input
                className="send-command-input text-sm"
                value={form[key] ?? ''}
                onChange={e => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Service address */}
      <div className="send-preview-address">
        <p className="send-preview-address__title">Service address</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ADDRESS_FIELDS.map(([key, label, span]) => (
            <div key={key} className={span === 'full' ? 'sm:col-span-2' : ''}>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted mb-1 block">
                {label}
              </label>
              <input
                className="send-command-input text-sm"
                value={form[key] ?? ''}
                onChange={e => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="send-preview-pricing-edit">
        <p className="send-preview-pricing-edit__title">Pricing</p>
        <div className="grid grid-cols-2 gap-2">
          {PRICING_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted mb-1 block">
                {label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted text-sm">$</span>
                <input
                  className="send-command-input send-command-input--money text-sm"
                  placeholder="0"
                  value={form[key] ?? ''}
                  onChange={e => set(key, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
        {form.initial && (
          <p className="text-sm font-semibold text-gs-accent mt-3 text-right">
            Final: {formatMoney(computeFinalQuote(pricing))}
          </p>
        )}
      </div>

      {/* Agreement date */}
      <div className="send-preview-address">
        <p className="send-preview-address__title">Agreement</p>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted mb-1 block">
            Agreement date
          </label>
          <input
            type="date"
            className="send-command-input text-sm"
            value={form.agreementDate ?? ''}
            onChange={e => set('agreementDate', e.target.value)}
          />
          <p className="text-[10px] text-gs-muted mt-1">Drives the 12-month calendar on the agreement.</p>
        </div>
      </div>

      {/* Service Details */}
      <div className="send-preview-address">
        <div className="flex items-center justify-between mb-1">
          <p className="send-preview-address__title mb-0">Service details</p>
          {isServiceDetailsOverridden && (
            <button
              type="button"
              onClick={() => set('serviceDetailsText', null)}
              className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted hover:text-gs-text transition-colors"
            >
              Use default
            </button>
          )}
        </div>
        <textarea
          className="send-command-input text-xs resize-none"
          rows={5}
          value={form.serviceDetailsText ?? TMM_SERVICE_DETAILS_DEFAULT}
          onChange={e => {
            const val = e.target.value;
            set('serviceDetailsText', val === TMM_SERVICE_DETAILS_DEFAULT ? null : val);
          }}
        />
        {!isServiceDetailsOverridden && (
          <p className="text-[10px] text-gs-muted mt-1">Default text — edit to override for this customer.</p>
        )}
      </div>
    </div>
  );
}
