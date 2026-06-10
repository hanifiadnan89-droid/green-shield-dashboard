import { applyBedBugFormPatch, computeBedBugTotals } from './bedBugAgreementUtils.js';
import { formatMoney } from './previewSendUtils.js';

const FIELD_GROUPS = [
  {
    title: 'Customer',
    fields: [
      ['customerName', 'Customer name'],
      ['phone', 'Phone'],
      ['email', 'Email'],
    ],
  },
  {
    title: 'Service address',
    fields: [
      ['serviceAddress', 'Address', 'full'],
      ['city', 'City'],
      ['state', 'State'],
      ['zip', 'Zip'],
    ],
  },
  {
    title: 'Pricing',
    fields: [
      ['initialQuote', 'Initial quote', 'money'],
      ['initialDiscount', 'Discount', 'money'],
      ['recurringCharge', 'Recurring charge', 'money'],
      ['recurringPaymentAuthorized', 'Recurring payment authorized', 'money'],
    ],
  },
  {
    title: 'Billing & signature',
    fields: [
      ['billingInfo', 'Billing info'],
      ['cardLastFour', 'Card last four'],
      ['agreementDate', 'Agreement date', 'date'],
      ['customerInitials', 'Customer initials'],
      ['customerSignatureName', 'Customer signature name'],
    ],
  },
];

export default function BedBugAgreementForm({ form, onChange, previewStale }) {
  const totals = computeBedBugTotals(form);

  function updateField(key, value) {
    onChange(applyBedBugFormPatch(form, { [key]: value }));
  }

  return (
    <div className="send-bedbug-form space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="send-preview-pricing-edit__title mb-0">Bed Bug Agreement Builder</p>
        {previewStale ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gs-warn">
            Preview stale — regenerate before emailing
          </span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gs-accent">
            Vector PDF template
          </span>
        )}
      </div>

      {FIELD_GROUPS.map((group) => (
        <div key={group.title} className="send-preview-address">
          <p className="send-preview-address__title">{group.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.fields.map(([key, label, type]) => (
              <div key={key} className={type === 'date' || type === 'full' ? 'sm:col-span-2' : ''}>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted mb-1 block">
                  {label}
                </label>
                {type === 'money' ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted text-sm">$</span>
                    <input
                      className="send-command-input send-command-input--money text-sm"
                      value={form[key] ?? ''}
                      onChange={(e) => updateField(key, e.target.value)}
                    />
                  </div>
                ) : (
                  <input
                    type={type === 'date' ? 'date' : 'text'}
                    className="send-command-input text-sm"
                    value={form[key] ?? ''}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="send-preview-pricing-edit">
        <p className="send-preview-pricing-edit__title">Computed totals</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gs-muted">Subtotal</span>
            <p className="font-semibold text-gs-text">{formatMoney(totals.initialSubtotal)}</p>
          </div>
          <div>
            <span className="text-gs-muted">Initial total</span>
            <p className="font-semibold text-gs-accent">{formatMoney(totals.initialTotal)}</p>
          </div>
          <div>
            <span className="text-gs-muted">Recurring total</span>
            <p className="font-semibold text-gs-text">{formatMoney(totals.recurringTotal)}</p>
          </div>
          <div>
            <span className="text-gs-muted">Authorized</span>
            <p className="font-semibold text-gs-text">{formatMoney(totals.recurringPaymentAuthorized)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
