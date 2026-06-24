import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle, FileText, ExternalLink, Check, AlertTriangle, MapPin, Eye, Calendar } from 'lucide-react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { formatMoney, computeFinalQuote } from './previewSendUtils.js';
import BedBugAgreementForm from './BedBugAgreementForm.jsx';
import {
  bedBugFormFingerprint,
  buildBedBugAgreementState,
  mergeBedBugPayload,
  validateBedBugForm,
} from './bedBugAgreementUtils.js';
import { buildCustomerAddressFromLead, prefillEmptyFields } from './customerPrefill.js';
import { buildIntakeQuotePrefill } from '../../utils/intake/buildIntakeLead.js';

function localIsoDate() {
  const now = new Date();
  // Adjust for local timezone so "today" is correct regardless of UTC offset
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10);
}

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
  const [agreementStartDate, setAgreementStartDate] = useState(localIsoDate);
  const [notes, setNotes]             = useState('');
  const [treatmentAcreage, setTreatmentAcreage] = useState(null);
  const [treatmentSquareFeet, setTreatmentSquareFeet] = useState(null);
  const [bedBugForm, setBedBugForm]   = useState(null);
  const [previewFingerprint, setPreviewFingerprint] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [previewing, setPreviewing]   = useState(false);
  const [emailing, setEmailing]       = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [signingSessions, setSigningSessions] = useState([]);
  const [genError, setGenError]       = useState(null);
  const [missing, setMissing]         = useState(false);
  const [appointmentDate, setAppointmentDate]     = useState('');
  const [appointmentWindow, setAppointmentWindow] = useState('');

  const isBedBug = selected?.templateKind === 'bed_bug' || selected?.name === 'Bed Bug.pdf';
  const useSigningFlow = Boolean(lead?.email || lead?.phone);
  const currentFingerprint = useMemo(
    () => (isBedBug && bedBugForm ? bedBugFormFingerprint(bedBugForm, pricing, address, agreementStartDate) : null),
    [isBedBug, bedBugForm, pricing, address, agreementStartDate],
  );
  const previewVerified = isBedBug && currentFingerprint && previewFingerprint === currentFingerprint;
  const previewStale = isBedBug && previewFingerprint && !previewVerified;

  useEffect(() => {
    api.documents.quotes().then(data => {
      setFiles(data.quotes || []);
      setMissing(!!data.missing);
    }).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!lead) return;
    setAddress((prev) => buildCustomerAddressFromLead(lead, prev));
    if (lead.fromIntake || lead.intake) {
      const intakePrefill = buildIntakeQuotePrefill(lead);
      setAddress((prev) => prefillEmptyFields(prev, intakePrefill.address));
      setNotes((prev) => prev || intakePrefill.notes || '');
      setTreatmentAcreage((prev) => prev ?? intakePrefill.treatmentAcreage);
      setTreatmentSquareFeet((prev) => prev ?? intakePrefill.treatmentSquareFeet);
    }
  }, [lead?.row_number, lead?.fromIntake, lead?.intake?.customer?.serviceAddress]);

  useEffect(() => {
    if (isBedBug && lead) {
      const base = buildBedBugAgreementState(lead, address, pricing, agreementStartDate);
      setBedBugForm((prev) => (prev ? prefillEmptyFields(prev, base) : base));
    } else if (!isBedBug) {
      setBedBugForm(null);
      setPreviewFingerprint(null);
    }
  }, [isBedBug, lead?.row_number, address.street, address.city, address.state, address.zip, address.cityState, pricing.initial, pricing.discounted, pricing.recurring, agreementStartDate]);

  useEffect(() => {
    if (!isBedBug || !bedBugForm) return;
    setPricing({
      initial: bedBugForm.initialQuote,
      discounted: bedBugForm.initialDiscount,
      recurring: bedBugForm.recurringCharge,
    });
    setAddress({
      street: bedBugForm.serviceAddress,
      city: bedBugForm.city,
      state: bedBugForm.state,
      zip: bedBugForm.zip,
      cityState: [bedBugForm.city, bedBugForm.state, bedBugForm.zip].filter(Boolean).join(', '),
    });
    if (bedBugForm.agreementDate) {
      setAgreementStartDate(bedBugForm.agreementDate);
    }
  }, [isBedBug, bedBugForm?.initialQuote, bedBugForm?.initialDiscount, bedBugForm?.recurringCharge, bedBugForm?.serviceAddress, bedBugForm?.city, bedBugForm?.state, bedBugForm?.zip, bedBugForm?.agreementDate]);

  useEffect(() => {
    onStateChange?.({
      pricing,
      address,
      notes,
      selected,
      agreementStartDate,
      bedBugForm,
      previewVerified,
      treatmentAcreage,
      treatmentSquareFeet,
      intake: lead?.intake || null,
    });
  }, [pricing, address, notes, selected, agreementStartDate, bedBugForm, previewVerified, treatmentAcreage, treatmentSquareFeet, lead?.intake, onStateChange]);

  useEffect(() => {
    if (!lead?.row_number || !selected) {
      setSigningSessions([]);
      return;
    }
    api.signing.sessions({ leadRow: lead.row_number })
      .then((data) => setSigningSessions(data.sessions || []))
      .catch(() => setSigningSessions([]));
  }, [lead?.row_number, selected?.key, emailResult]);

  function buildPayload(extra = {}) {
    const cityState = address.cityState
      || [address.city, [address.state, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const base = {
      index:            selected.index,
      serviceType:      selected.serviceType || null,
      lead:             {
        row_number: lead?.row_number,
        name: lead?.name,
        email: lead?.email,
        phone: lead?.phone,
      },
      pricing,
      notes,
      address: {
        ...address,
        cityState,
      },
      agreementStartDate: agreementStartDate || undefined,
      startDate: agreementStartDate || undefined,
      prepGuideIndices,
      treatmentAcreage: treatmentAcreage ?? undefined,
      treatmentSquareFeet: treatmentSquareFeet ?? undefined,
      intake: lead?.intake || undefined,
      ...extra,
    };
    if (isBedBug && bedBugForm) {
      return mergeBedBugPayload(base, bedBugForm);
    }
    return base;
  }

  function validateBeforeGenerate() {
    if (!isBedBug) return null;
    const errors = validateBedBugForm(bedBugForm);
    return errors.length ? errors.join('; ') : null;
  }

  async function requestPdf({ preview = false, download = false } = {}) {
    const validationError = validateBeforeGenerate();
    if (validationError) throw new Error(validationError);

    const res = await fetch('/api/documents/generate-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload({ preview, previewVerified: preview || previewVerified })),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const fnMatch = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = fnMatch ? decodeURIComponent(fnMatch[1]) : 'quote.pdf';

    if (download) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    if (isBedBug) {
      setPreviewFingerprint(currentFingerprint);
    }
    return filename;
  }

  async function handlePreview() {
    if (!selected) return;
    setPreviewing(true);
    setGenError(null);
    setEmailResult(null);
    try {
      await requestPdf({ preview: true });
    } catch (err) {
      setGenError(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    setGenError(null);
    setEmailResult(null);
    try {
      await requestPdf({ preview: false, download: true });
      if (isBedBug) setPreviewFingerprint(currentFingerprint);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleEmail() {
    if (!selected || (!lead?.email && !lead?.phone)) return;
    if (isBedBug && !previewVerified) {
      setGenError('Preview the Bed Bug agreement PDF before emailing.');
      return;
    }
    setEmailing(true);
    setGenError(null);
    setEmailResult(null);
    try {
      const result = await api.documents.emailQuote(buildPayload({ previewVerified: true }));
      setEmailResult({ ok: true, signing: result.signing || null, channels: result.channels || {} });
    } catch (err) {
      setEmailResult({ ok: false, error: err.message });
    } finally {
      setEmailing(false);
    }
  }

  async function handleEmailWithCalendar() {
    if (!selected || (!lead?.email && !lead?.phone)) return;
    if (!appointmentDate) { setGenError('Enter an appointment date for the calendar invite.'); return; }
    if (!appointmentWindow.trim()) { setGenError('Enter an appointment window (e.g. 8:00 AM – 11:00 AM).'); return; }
    if (isBedBug && !previewVerified) { setGenError('Preview the Bed Bug agreement PDF before emailing.'); return; }
    setEmailing(true);
    setGenError(null);
    setEmailResult(null);
    try {
      const result = await api.documents.emailQuote(buildPayload({
        previewVerified: true,
        calendarInvite: true,
        appointmentDate,
        appointmentWindow: appointmentWindow.trim(),
      }));
      setEmailResult({ ok: true, signing: result.signing || null, hasCalendar: true, channels: result.channels || {} });
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
  const emailBlocked = bedBugEmailDisabled || (isBedBug && !previewVerified);

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
                onClick={() => {
                  const deselecting = selected?.key === f.key;
                  setSelected(deselecting ? null : f);
                  if (!deselecting && f.serviceType === 'tick_mosquito_monthly') {
                    setPricing({ initial: '119', recurring: '119', discounted: '' });
                  }
                }}
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
                {f.serviceType ? (
                  <span
                    className="send-doc-card__preview text-xs text-gs-muted shrink-0"
                    title="Use Preview PDF or Download PDF below — this is not the filled agreement"
                  >
                    Template
                  </span>
                ) : (
                  <a
                    href={api.documents.fileUrl('quotes', f.index)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="send-doc-card__preview text-xs text-gs-info hover:underline shrink-0"
                  >
                    Blank
                  </a>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {isBedBug && bedBugForm ? (
          <BedBugAgreementForm
            form={bedBugForm}
            onChange={setBedBugForm}
            previewStale={previewStale}
          />
        ) : (
          <>
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

            {lead?.fromIntake && (treatmentAcreage != null || treatmentSquareFeet != null) && (
              <div className="send-preview-profile mt-3">
                <p className="send-preview-profile__title">Intake property intelligence</p>
                <div className="send-preview-profile__grid">
                  {treatmentAcreage != null && (
                    <div className="send-preview-profile__cell">
                      <p className="send-preview-profile__label">Treatment acreage</p>
                      <p className="send-preview-profile__value">{treatmentAcreage} acres</p>
                    </div>
                  )}
                  {treatmentSquareFeet != null && (
                    <div className="send-preview-profile__cell">
                      <p className="send-preview-profile__label">Treatment sq ft</p>
                      <p className="send-preview-profile__value">{Number(treatmentSquareFeet).toLocaleString('en-US')}</p>
                    </div>
                  )}
                  {lead.intake?.latitude != null && (
                    <div className="send-preview-profile__cell">
                      <p className="send-preview-profile__label">Coordinates</p>
                      <p className="send-preview-profile__value">{lead.intake.latitude}, {lead.intake.longitude}</p>
                    </div>
                  )}
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
                <div className="grid grid-cols-3 gap-2">
                  <input
                    className="send-command-input text-sm"
                    placeholder="City"
                    value={address.city || ''}
                    onChange={e => setAddress(p => ({ ...p, city: e.target.value }))}
                  />
                  <input
                    className="send-command-input text-sm"
                    placeholder="State"
                    value={address.state || ''}
                    onChange={e => setAddress(p => ({ ...p, state: e.target.value }))}
                  />
                  <input
                    className="send-command-input text-sm"
                    placeholder="ZIP"
                    value={address.zip || ''}
                    onChange={e => setAddress(p => ({ ...p, zip: e.target.value }))}
                  />
                </div>
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
                Drives the 12-month calendar on the agreement.
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

          </>
        )}

        {!isBedBug && (
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
        )}
      </div>

      {/* Footer */}
      <div className="send-doc-panel__footer px-4 py-3 border-t border-gs-border space-y-2">
        {genError && (
          <p className="send-command-alert send-command-alert--error">{genError}</p>
        )}
        {emailResult && (
          emailResult.ok
            ? <div className="space-y-1">
                <p className="send-command-alert send-command-alert--success flex items-center gap-1.5">
                  <CheckCircle size={11} />
                  {emailResult.signing
                    ? (() => {
                        const via = [
                          emailResult.channels?.email && 'email',
                          emailResult.channels?.sms && 'SMS',
                        ].filter(Boolean).join(' + ');
                        return `Signing link${emailResult.hasCalendar ? ' + calendar' : ''} sent via ${via || 'email'}`;
                      })()
                    : `Quote sent to ${lead?.email || lead?.phone}`}
                </p>
                {emailResult.channels?.smsError && (
                  <p className="send-command-alert send-command-alert--warn flex items-center gap-1.5 text-xs">
                    <AlertTriangle size={11} /> SMS failed: {emailResult.channels.smsError}
                  </p>
                )}
                {emailResult.signing?.signUrl ? (
                  <p className="text-[11px] text-gs-muted break-all">
                    Sign link: {emailResult.signing.signUrl}
                  </p>
                ) : null}
              </div>
            : <p className="send-command-alert send-command-alert--error">{emailResult.error}</p>
        )}

        <button
          onClick={handlePreview}
          disabled={!selected || previewing || generating || emailing}
          className={`send-command-secondary ${
            !selected || previewing || generating || emailing ? 'send-command-secondary--disabled' : ''
          }`}
        >
          {previewing ? <><Spinner size={12} /> Previewing...</> : <><Eye size={12} /> Preview PDF</>}
        </button>

        {/* Download */}
        <button
          onClick={handleGenerate}
          disabled={!selected || generating || emailing || previewing}
          className={`send-command-secondary ${
            !selected || generating || emailing || previewing ? 'send-command-secondary--disabled' : ''
          }`}
        >
          {generating ? <><Spinner size={12} /> Generating...</> : <><FileText size={12} /> Download PDF</>}
        </button>

        {/* Send signing link / quote to customer */}
        <button
          onClick={handleEmail}
          disabled={!selected || (!lead?.email && !lead?.phone) || emailing || generating || previewing || emailBlocked}
          title={
            bedBugEmailDisabled
              ? bedBugEmailDisabledMessage
              : isBedBug && !previewVerified
                ? 'Preview the agreement PDF before sending'
                : (!lead?.email && !lead?.phone)
                  ? 'No email or phone on this lead'
                  : ''
          }
          className={`send-launch-cta text-xs ${
            !selected || (!lead?.email && !lead?.phone) || emailing || generating || previewing || emailBlocked
              ? 'opacity-40 cursor-not-allowed'
              : ''
          }`}
        >
          {emailing
            ? <><Spinner size={12} /> Sending...</>
            : <><Send size={12} /> {useSigningFlow ? 'Send Signing Link' : 'Email Quote'} to {lead?.name?.split(' ')[0] || 'Customer'}</>
          }
        </button>
        {useSigningFlow && selected && (lead?.email || lead?.phone) && (
          <p className="text-[10px] text-gs-muted text-center">
            via {[lead?.email && 'email', lead?.phone && 'SMS'].filter(Boolean).join(' + ')}
          </p>
        )}

        {/* Send Agreement + Calendar Invite */}
        {useSigningFlow && selected && !bedBugEmailDisabled && (
          <div className="border-t border-gs-border pt-2 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gs-muted flex items-center gap-1.5">
              <Calendar size={10} aria-hidden="true" /> Appointment (calendar invite)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted mb-1 block">
                  Date
                </label>
                <input
                  type="date"
                  className="send-command-input text-sm"
                  value={appointmentDate}
                  onChange={e => setAppointmentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gs-muted mb-1 block">
                  Window
                </label>
                <input
                  type="text"
                  className="send-command-input text-sm"
                  placeholder="e.g. 8:00 AM – 11:00 AM"
                  value={appointmentWindow}
                  onChange={e => setAppointmentWindow(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={handleEmailWithCalendar}
              disabled={!selected || (!lead?.email && !lead?.phone) || emailing || generating || previewing || emailBlocked}
              title={
                (!lead?.email && !lead?.phone) ? 'No email or phone on this lead'
                : !appointmentDate ? 'Enter appointment date above'
                : !appointmentWindow.trim() ? 'Enter appointment window above'
                : ''
              }
              className={`send-launch-cta text-xs ${
                !selected || (!lead?.email && !lead?.phone) || emailing || generating || previewing || emailBlocked || !appointmentDate || !appointmentWindow.trim()
                  ? 'opacity-40 cursor-not-allowed'
                  : ''
              }`}
            >
              {emailing
                ? <><Spinner size={12} /> Sending...</>
                : <><Calendar size={12} /> Send Signing Link + Calendar to {lead?.name?.split(' ')[0] || 'Customer'}</>
              }
            </button>
          </div>
        )}

        {bedBugEmailDisabled && selected && isBedBug && (
          <p className="send-command-alert send-command-alert--warning flex items-center gap-1.5 text-xs">
            <AlertTriangle size={11} /> {bedBugEmailDisabledMessage}
          </p>
        )}

        {isBedBug && !bedBugEmailDisabled && previewStale && (
          <p className="send-command-alert send-command-alert--warning flex items-center gap-1.5 text-xs">
            <AlertTriangle size={11} /> Agreement fields changed after preview — preview again before emailing.
          </p>
        )}

        {!lead?.email && !lead?.phone && selected && !bedBugEmailDisabled && (
          <p className="text-gs-muted text-xs text-center">No email or phone on this lead — can't send directly</p>
        )}

        {selected && !isBedBug && !selected.serviceType && (
          <a
            href={api.documents.fileUrl('quotes', selected.index)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-gs-muted text-xs hover:underline"
          >
            <ExternalLink size={11} /> View blank template: {selected.name}
          </a>
        )}
        {selected?.serviceType && (
          <p className="text-[10px] text-gs-muted text-center">
            Use Preview PDF or Download PDF for the filled agreement. Blank template links do not apply to service agreements.
          </p>
        )}

        {useSigningFlow && signingSessions.length > 0 && (
          <div className="rounded-lg border border-gs-border bg-gs-card/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-gs-text">Agreement signing records</p>
            {signingSessions.slice(0, 3).map((session) => (
              <div key={session.token} className="text-[11px] text-gs-muted flex items-center justify-between gap-2">
                <span className="truncate">
                  {session.status === 'signed' ? 'Signed' : 'Awaiting signature'}
                  {session.signedAt ? ` · ${new Date(session.signedAt).toLocaleDateString()}` : ''}
                </span>
                {session.status === 'signed' ? (
                  <a
                    href={api.signing.signedPdfUrl(session.token)}
                    className="text-gs-info hover:underline shrink-0"
                  >
                    Download
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
