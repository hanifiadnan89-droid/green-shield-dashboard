import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle, FileText, ExternalLink, Check, AlertTriangle, MapPin } from 'lucide-react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { formatMoney, computeFinalQuote } from './previewSendUtils.js';

/* ── Quote Documents Section ── */
export default function QuoteDocumentsSection({
  lead,
  prepGuideIndices = [],
  onStateChange,
  variant = 'default',
}) {
  const [files, setFiles]             = useState(null);
  const [selected, setSelected]       = useState(null);
  const [pricing, setPricing]         = useState({ initial: '', recurring: '', discounted: '' });
  const [address, setAddress]         = useState({ street: '', cityState: '' });
  const [agreementStartDate, setAgreementStartDate] = useState('');
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [emailing, setEmailing]       = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [genError, setGenError]       = useState(null);
  const [missing, setMissing]         = useState(false);

  useEffect(() => {
    api.documents.quotes().then(data => {
      setFiles(data.quotes || []);
      setMissing(!!data.missing);
    }).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    onStateChange?.({ pricing, address, notes, selected, agreementStartDate });
  }, [pricing, address, notes, selected, agreementStartDate, onStateChange]);

  function buildPayload() {
    return {
      index:            selected.index,
      serviceType:      selected.serviceType || null,
      lead:             { name: lead?.name, email: lead?.email, phone: lead?.phone },
      pricing,
      notes,
      address,
      agreementStartDate: agreementStartDate || undefined,
      startDate: agreementStartDate || undefined,
      prepGuideIndices,
    };
  }

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    setGenError(null);
    setEmailResult(null);
    try {
      const res = await fetch('/api/documents/generate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const fnMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = fnMatch ? decodeURIComponent(fnMatch[1]) : 'quote.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleEmail() {
    if (!selected || !lead?.email) return;
    setEmailing(true);
    setGenError(null);
    setEmailResult(null);
    try {
      await api.documents.emailQuote(buildPayload());
      setEmailResult({ ok: true, to: lead.email });
    } catch (err) {
      setEmailResult({ ok: false, error: err.message });
    } finally {
      setEmailing(false);
    }
  }

  const isPreview = variant === 'preview';
  const shellClass = isPreview ? 'send-doc-panel' : 'card flex flex-col gap-0 p-0 overflow-hidden';
  const bedBugEmailDisabled = Boolean(selected?.emailDisabled);
  const bedBugEmailDisabledMessage = selected?.emailDisabledMessage
    || 'Bed Bug agreement email is temporarily disabled until PDF layout is verified.';

  return (
    <div className={shellClass}>
      {/* Header */}
      <div className="send-doc-panel__header px-4 py-3 border-b border-gs-border flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-gs-accent/12 border border-gs-accent/20">
          <FileText size={14} className="text-gs-accent" />
        </div>
        <div>
          <p className="send-doc-panel__title font-semibold text-sm">Quote Documents</p>
          <p className="send-doc-panel__subtitle text-xs">~/Desktop/Quotes</p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 flex-1">
        {/* File list */}
        {loading ? (
          <div className="space-y-2 py-2" aria-busy="true" aria-label="Loading quote documents">
            <div className="send-doc-skeleton" />
            <div className="send-doc-skeleton" />
            <div className="send-doc-skeleton" />
          </div>
        ) : missing ? (
          <div className="send-command-alert send-command-alert--warn text-xs flex items-center gap-2">
            <AlertTriangle size={12} /> Folder not found: ~/Desktop/Quotes
          </div>
        ) : files?.length === 0 ? (
          <p className="text-gs-muted text-xs py-2 text-center">No PDFs found in Quotes folder</p>
        ) : (
          <div className="space-y-2">
            {files.map((f, i) => (
              <motion.button
                key={f.key}
                type="button"
                onClick={() => setSelected(s => s?.key === f.key ? null : f)}
                className={`send-doc-card ${selected?.key === f.key ? 'send-doc-card--selected' : ''}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="send-doc-card__shimmer" aria-hidden />
                <div className={`send-doc-card__check ${selected?.key === f.key ? 'send-doc-card__check--on' : ''}`}>
                  {selected?.key === f.key && <Check size={10} strokeWidth={3} />}
                </div>
                <FileText size={16} className="shrink-0 text-gs-accent opacity-80" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gs-text truncate">{f.name}</p>
                  <p className="text-[10px] text-gs-muted uppercase tracking-wide mt-0.5">PDF · {(f.size / 1024).toFixed(0)} KB</p>
                </div>
                <a
                  href={api.documents.fileUrl('quotes', f.index)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="send-doc-card__preview text-xs text-gs-info hover:underline shrink-0"
                >
                  Preview
                </a>
              </motion.button>
            ))}
          </div>
        )}

        {/* Customer info preview */}
        {lead && (
          <div className="send-preview-profile">
            <p className="send-preview-profile__title">Customer profile</p>
            <div className="send-preview-profile__grid">
              {[
                ['Name', lead.name],
                ['Phone', lead.phone],
                ['Email', lead.email],
                ['Reason', lead.reason],
                ['Notes', lead.notes],
                ['Status', lead.status],
              ].map(([label, val]) => (
                <div key={label} className="send-preview-profile__cell">
                  <p className="send-preview-profile__label">{label}</p>
                  <p className="send-preview-profile__value">{val || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="send-preview-address">
          <p className="send-preview-address__title">
            <MapPin size={14} className="inline mr-1.5 -mt-0.5 text-gs-accent" />
            Service address
          </p>
          <div className="space-y-2">
            <input
              className="send-command-input text-sm"
              placeholder="Street address"
              value={address.street}
              onChange={e => setAddress(p => ({ ...p, street: e.target.value }))}
            />
            <input
              className="send-command-input text-sm"
              placeholder="City, State ZIP"
              value={address.cityState}
              onChange={e => setAddress(p => ({ ...p, cityState: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gs-muted uppercase tracking-widest mb-1.5 block">
            Agreement start date
          </label>
          <input
            type="date"
            className="send-command-input text-sm"
            value={agreementStartDate}
            onChange={e => setAgreementStartDate(e.target.value)}
          />
          <p className="text-[10px] text-gs-muted mt-1 mb-0">
            Drives the 12-month calendar on the agreement. Leave blank to use today.
          </p>
        </div>

        <div className="send-preview-pricing-edit">
          <p className="send-preview-pricing-edit__title">Quote pricing</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['initial', 'Initial quote'],
              ['discounted', 'Discount'],
              ['recurring', 'Recurring / mo'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted mb-1 block">
                  {label}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted text-sm">$</span>
                  <input
                    className="send-command-input send-command-input--money text-sm"
                    placeholder="0"
                    value={pricing[key]}
                    onChange={e => setPricing(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>
          {pricing.initial && (
            <p className="text-sm font-semibold text-gs-accent mt-3 text-right">
              Final: {formatMoney(computeFinalQuote(pricing))}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gs-muted uppercase tracking-widest mb-1.5 block">
            Notes (bottom-right of quote)
          </label>
          <textarea
            className="send-command-input text-xs resize-none"
            rows={3}
            placeholder="Add custom notes for this customer's quote..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="send-doc-panel__footer px-4 py-3 border-t border-gs-border space-y-2">
        {genError && (
          <p className="send-command-alert send-command-alert--error">{genError}</p>
        )}
        {emailResult && (
          emailResult.ok
            ? <p className="send-command-alert send-command-alert--success flex items-center gap-1.5">
                <CheckCircle size={11} /> Quote sent to {emailResult.to}
              </p>
            : <p className="send-command-alert send-command-alert--error">{emailResult.error}</p>
        )}

        {/* Download */}
        <button
          onClick={handleGenerate}
          disabled={!selected || generating || emailing}
          className={`send-command-secondary ${
            !selected || generating || emailing ? 'send-command-secondary--disabled' : ''
          }`}
        >
          {generating ? <><Spinner size={12} /> Generating...</> : <><FileText size={12} /> Download PDF</>}
        </button>

        {/* Email to customer — direct from CRM, no n8n */}
        <button
          onClick={handleEmail}
          disabled={!selected || !lead?.email || emailing || generating || bedBugEmailDisabled}
          title={
            bedBugEmailDisabled
              ? bedBugEmailDisabledMessage
              : !lead?.email
                ? 'No email address on this lead'
                : ''
          }
          className={`send-launch-cta text-xs ${
            !selected || !lead?.email || emailing || generating || bedBugEmailDisabled
              ? 'opacity-40 cursor-not-allowed'
              : ''
          }`}
        >
          {emailing
            ? <><Spinner size={12} /> Sending...</>
            : <><Send size={12} /> Email Quote to {lead?.email ? lead.name?.split(' ')[0] || 'Customer' : 'Customer'}</>
          }
        </button>

        {bedBugEmailDisabled && selected && (
          <p className="send-command-alert send-command-alert--warning flex items-center gap-1.5 text-xs">
            <AlertTriangle size={11} /> {bedBugEmailDisabledMessage}
          </p>
        )}

        {!lead?.email && selected && !bedBugEmailDisabled && (
          <p className="text-gs-muted text-xs text-center">No email on this lead — can't send directly</p>
        )}

        {selected && (
          <a
            href={api.documents.fileUrl('quotes', selected.index)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-gs-info text-xs hover:underline"
          >
            <ExternalLink size={11} /> Preview template: {selected.name}
          </a>
        )}
      </div>
    </div>
  );
}
