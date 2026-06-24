import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import SignaturePad from './SignaturePad.jsx';
import './agreement-sign.css';

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function deriveInitials(name) {
  if (!name) return '';
  return name.trim().split(/\s+/)
    .filter(p => /^[a-zA-Z]/.test(p))
    .map(p => p[0].toUpperCase())
    .slice(0, 3)
    .join('');
}

function initialsToDataUrl(text) {
  if (!text) return null;
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 120;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 68px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);
  return c.toDataURL('image/png');
}

async function fetchSigningSession(token) {
  const res = await fetch(`/api/signing/public/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.session;
}

async function submitSigningSession(token, body) {
  const res = await fetch(`/api/signing/public/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function AgreementSignPage() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Feature 1: tap-to-enlarge preview + full PDF viewer
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  // Feature 2: text-based initials (no drawing required)
  const [initialsText, setInitialsText] = useState('');
  const [initialsEditMode, setInitialsEditMode] = useState(false);
  const [initialsPng, setInitialsPng] = useState(null);

  // Signature: still drawn
  const [signaturePng, setSignaturePng] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const [signatureDate, setSignatureDate] = useState(todayIsoDate());
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSigningSession(token)
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        setCompleted(data.status === 'signed');
        // Auto-derive initials from customer name — no drawing needed
        const derived = deriveInitials(data.customerName);
        if (derived) {
          setInitialsText(derived);
          setInitialsPng(initialsToDataUrl(derived));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const previewUrl = useMemo(
    () => (session?.hasPreview ? `/api/signing/public/${token}/preview.png` : null),
    [session?.hasPreview, token],
  );

  const documentPdfUrl = `/api/signing/public/${token}/document.pdf`;

  function handleOpenPdf() {
    // iOS Safari cannot render PDFs inside iframes — open in new tab instead
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      window.open(documentPdfUrl, '_blank', 'noopener,noreferrer');
    } else {
      setPdfViewerOpen(true);
    }
  }

  function applyInitialsText() {
    const text = initialsText.trim().toUpperCase();
    if (!text) return;
    setInitialsPng(initialsToDataUrl(text));
    setInitialsEditMode(false);
  }

  const canSubmit = Boolean(
    initialsPng
    && signaturePng
    && signatureDate
    && consentAccepted
    && session?.status === 'pending'
    && !session?.expired,
  );

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitSigningSession(token, {
        initialsPng,
        signaturePng,
        signatureDate,
        consentAccepted: true,
        typedInitials: initialsText,
      });
      setCompleted(true);
      setSession((prev) => ({ ...prev, status: 'signed' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="agreement-sign-page">
        <div className="agreement-sign-page__shell">
          <p>Loading your agreement…</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="agreement-sign-page">
        <div className="agreement-sign-page__shell">
          <div className="agreement-sign-page__alert agreement-sign-page__alert--error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="agreement-sign-page">
      <div className="agreement-sign-page__shell">
        <div className="agreement-sign-page__brand">
          <div className="agreement-sign-page__brand-mark">GS</div>
          <div>
            <h1 className="agreement-sign-page__title">Green Shield Pest Solutions</h1>
            <p className="agreement-sign-page__subtitle">
              {session?.customerName
                ? `Agreement for ${session.customerName}`
                : 'Service agreement'}
            </p>
          </div>
        </div>

        {completed ? (
          <div className="agreement-sign-page__alert agreement-sign-page__alert--success">
            Thank you — your signed agreement has been submitted. A copy has been emailed to you
            for your records.
          </div>
        ) : null}

        {error ? (
          <div className="agreement-sign-page__alert agreement-sign-page__alert--error">{error}</div>
        ) : null}

        {session?.expired && session?.status !== 'signed' ? (
          <div className="agreement-sign-page__alert agreement-sign-page__alert--error">
            This signing link has expired. Please contact Green Shield at (207) 815-2234
            for a new link.
          </div>
        ) : null}

        {/* Feature 1: tappable preview with fullscreen lightbox */}
        {previewUrl ? (
          <>
            <button
              type="button"
              className="agreement-sign-page__preview agreement-sign-page__preview--tap"
              onClick={() => setPreviewOpen(true)}
              aria-label="Tap to enlarge agreement preview"
            >
              <img src={previewUrl} alt="Agreement preview" />
              <span className="agreement-sign-page__preview-hint">Tap to enlarge &amp; review</span>
            </button>

            {previewOpen ? (
              <div
                className="agreement-sign-page__lightbox"
                role="dialog"
                aria-modal="true"
                aria-label="Agreement preview"
              >
                <button
                  type="button"
                  className="agreement-sign-page__lightbox-close"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Close preview"
                >
                  ✕
                </button>
                <div className="agreement-sign-page__lightbox-body">
                  <img src={previewUrl} alt="Agreement preview" />
                  <button
                    type="button"
                    className="agreement-sign-page__lightbox-pdf"
                    onClick={handleOpenPdf}
                  >
                    View full PDF
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {!completed && session?.status === 'pending' && !session?.expired ? (
          <div className="agreement-sign-page__panel">
            <h2>Sign your agreement</h2>
            <p>
              Review the agreement above, then complete the fields below and submit.
            </p>

            <div className="agreement-sign-page__fields">
              {/* Feature 2: initials auto-filled from customer name — no drawing needed */}
              <div className={`agreement-sign-page__field ${initialsPng && !initialsEditMode ? 'agreement-sign-page__field--done' : ''}`}>
                <div className="agreement-sign-page__field-label">Customer Initials</div>

                {initialsEditMode || !initialsPng ? (
                  <div className="agreement-sign-page__initials-edit">
                    <input
                      type="text"
                      className="agreement-sign-page__initials-input"
                      value={initialsText}
                      maxLength={4}
                      placeholder="e.g. MS"
                      autoCapitalize="characters"
                      onChange={(e) => setInitialsText(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && applyInitialsText()}
                    />
                    <button
                      type="button"
                      className="agreement-sign-page__initials-apply"
                      disabled={!initialsText.trim()}
                      onClick={applyInitialsText}
                    >
                      Apply Initials
                    </button>
                    {initialsEditMode ? (
                      <button
                        type="button"
                        className="agreement-sign-page__initials-cancel"
                        onClick={() => setInitialsEditMode(false)}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="agreement-sign-page__field-preview">
                      <img src={initialsPng} alt="Your initials" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setInitialsEditMode(true)}
                    >
                      Edit Initials
                    </button>
                  </>
                )}
              </div>

              {/* Signature — still drawn */}
              <div className={`agreement-sign-page__field ${signaturePng ? 'agreement-sign-page__field--done' : ''}`}>
                <div className="agreement-sign-page__field-label">Customer Signature</div>
                <div className="agreement-sign-page__field-preview">
                  {signaturePng
                    ? <img src={signaturePng} alt="Signature preview" />
                    : <span>Tap to sign</span>}
                </div>
                <button type="button" onClick={() => setShowSignaturePad(true)}>
                  {signaturePng ? 'Edit Signature' : 'Add Signature'}
                </button>
              </div>

              <div className={`agreement-sign-page__field ${signatureDate ? 'agreement-sign-page__field--done' : ''}`}>
                <div className="agreement-sign-page__field-label">Date</div>
                <input
                  type="date"
                  className="agreement-sign-page__date-input"
                  value={signatureDate}
                  onChange={(e) => setSignatureDate(e.target.value)}
                />
              </div>
            </div>

            <label className="agreement-sign-page__consent">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
              />
              <span>
                I have reviewed this agreement and authorize Green Shield Pest Solutions
                to charge my payment method as described. I understand this electronic
                signature is legally binding.
              </span>
            </label>

            <button
              type="button"
              className="agreement-sign-page__submit"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting…' : 'Submit Signed Agreement'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Full PDF viewer modal — desktop/Android only; iOS opens in new tab */}
      {pdfViewerOpen ? (
        <div
          className="agreement-sign-page__pdf-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Agreement PDF"
        >
          <div className="agreement-sign-page__pdf-modal-bar">
            <span className="agreement-sign-page__pdf-modal-title">Agreement PDF</span>
            <div className="agreement-sign-page__pdf-modal-actions">
              <a
                href={documentPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="agreement-sign-page__pdf-modal-newtab"
              >
                Open in new tab
              </a>
              <button
                type="button"
                className="agreement-sign-page__pdf-modal-close"
                onClick={() => setPdfViewerOpen(false)}
                aria-label="Close PDF viewer"
              >
                ✕
              </button>
            </div>
          </div>
          <iframe
            src={documentPdfUrl}
            title="Agreement PDF"
            className="agreement-sign-page__pdf-modal-frame"
          />
        </div>
      ) : null}

      {/* Signature pad modal — only for the drawn signature */}
      {showSignaturePad ? (
        <div className="agreement-sign-page__modal-backdrop" role="presentation">
          <div className="agreement-sign-page__modal" role="dialog" aria-modal="true">
            <SignaturePad
              label="Draw your signature"
              hint="Use your finger or mouse, then tap Done."
              height={180}
              onDone={(dataUrl) => {
                setSignaturePng(dataUrl);
                setShowSignaturePad(false);
              }}
            />
            <button
              type="button"
              className="agreement-sign-page__modal-close"
              onClick={() => setShowSignaturePad(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
