import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import SignaturePad from './SignaturePad.jsx';
import TypedInitialsInput from './TypedInitialsInput.jsx';
import { renderInitialsToPngDataUrl } from './initialsToPng.js';
import './agreement-sign.css';

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
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

  const [typedInitials, setTypedInitials] = useState('');
  const [initialsPng, setInitialsPng] = useState(null);
  const [signaturePng, setSignaturePng] = useState(null);
  const [signatureDate, setSignatureDate] = useState(todayIsoDate());
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [activePad, setActivePad] = useState(null);
  const [showInitialsInput, setShowInitialsInput] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSigningSession(token)
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        setCompleted(data.status === 'signed');
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

  const canSubmit = Boolean(
    typedInitials
    && initialsPng
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
        typedInitials,
        consentAccepted: true,
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

        {previewUrl ? (
          <div className="agreement-sign-page__preview">
            <img src={previewUrl} alt="Agreement preview" />
          </div>
        ) : null}

        {!completed && session?.status === 'pending' && !session?.expired ? (
          <div className="agreement-sign-page__panel">
            <h2>Sign your agreement</h2>
            <p>
              Type your initials, draw your signature, and confirm the signing date.
              When everything is complete, submit the agreement.
            </p>

            <div className="agreement-sign-page__fields">
              <div className={`agreement-sign-page__field ${typedInitials ? 'agreement-sign-page__field--done' : ''}`}>
                <div className="agreement-sign-page__field-label">Customer Initials</div>
                <div className="agreement-sign-page__field-preview agreement-sign-page__field-preview--initials">
                  {typedInitials
                    ? <span className="agreement-sign-page__initials-text">{typedInitials}</span>
                    : <span>Tap to type your initials</span>}
                </div>
                <button type="button" onClick={() => setShowInitialsInput(true)}>
                  {typedInitials ? 'Edit Initials' : 'Type Initials'}
                </button>
              </div>

              <div className={`agreement-sign-page__field ${signaturePng ? 'agreement-sign-page__field--done' : ''}`}>
                <div className="agreement-sign-page__field-label">Customer Signature</div>
                <div className="agreement-sign-page__field-preview">
                  {signaturePng
                    ? <img src={signaturePng} alt="Signature preview" />
                    : <span>Tap to sign</span>}
                </div>
                <button type="button" onClick={() => setActivePad('signature')}>
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

      {showInitialsInput ? (
        <div className="agreement-sign-page__modal-backdrop" role="presentation">
          <div className="agreement-sign-page__modal" role="dialog" aria-modal="true">
            <TypedInitialsInput
              initialValue={typedInitials}
              onDone={(value) => {
                const png = renderInitialsToPngDataUrl(value);
                if (!png) return;
                setTypedInitials(value);
                setInitialsPng(png);
                setShowInitialsInput(false);
              }}
            />
            <button
              type="button"
              className="agreement-sign-page__modal-close"
              onClick={() => setShowInitialsInput(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {activePad === 'signature' ? (
        <div className="agreement-sign-page__modal-backdrop" role="presentation">
          <div className="agreement-sign-page__modal" role="dialog" aria-modal="true">
            <SignaturePad
              label="Draw your signature"
              hint="Use your finger or mouse, then tap Done."
              height={180}
              onDone={(dataUrl) => {
                setSignaturePng(dataUrl);
                setActivePad(null);
              }}
            />
            <button
              type="button"
              className="agreement-sign-page__modal-close"
              onClick={() => setActivePad(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
