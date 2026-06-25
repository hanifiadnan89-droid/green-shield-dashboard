import { useState } from 'react';
import { Clipboard, ClipboardCheck, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { api } from '../../../api/client.js';

const QUICK_OBJECTIONS = [
  { key: 'expensive',  label: 'Too expensive',           text: "It's too expensive for me right now." },
  { key: 'think',      label: 'Need to think about it',  text: 'I need to think about it.' },
  { key: 'spouse',     label: 'Spouse approval',         text: 'I need to run it by my spouse first.' },
  { key: 'provider',   label: 'Already have a provider', text: 'I already have a pest control company.' },
  { key: 'safe',       label: 'Is it safe?',             text: 'Is the treatment safe for my family and pets?' },
  { key: 'later',      label: 'Call me later',           text: 'Can you call me back later?' },
];

const ACTIONS = [
  { key: 'shorten',  label: 'Shorten' },
  { key: 'softer',   label: 'Make softer' },
  { key: 'stronger', label: 'Stronger close' },
];

export default function ObjectionAssistant({ context = {} }) {
  const [repQuestion, setRepQuestion] = useState('');
  const [result, setResult]           = useState(null); // { recommendedResponse, salesAngle, softerVersion }
  const [loading, setLoading]         = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedRec, setCopiedRec]     = useState(false);
  const [copiedSoft, setCopiedSoft]   = useState(false);
  const [error, setError]             = useState(null);

  async function generate() {
    const q = repQuestion.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCopiedRec(false);
    setCopiedSoft(false);
    try {
      const data = await api.ai.salesCoach({
        mode: 'objectionAssistant',
        propertyContext: {
          customerName:       context.customerName   || null,
          address:            context.address         || null,
          propertyType:       context.propertyType    || null,
          serviceType:        context.serviceType     || null,
          treatmentAcreage:   context.treatmentAcreage  ?? null,
          treatmentSquareFeet: context.treatmentSquareFeet ?? null,
          weather:            context.weather         || null,
          suitability:        context.suitability     || null,
        },
        leadContext: {
          pricing:         context.pricing         || null,
          leadNotes:       context.leadNotes       || null,
          previousMessage: context.previousMessage || null,
          recommendations: context.recommendations || null,
        },
        repQuestion: q,
      });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to generate response.');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action) {
    if (!result?.recommendedResponse?.trim()) return;
    setActionLoading(action);
    setError(null);
    setCopiedRec(false);
    try {
      const data = await api.ai.objectionAssist({
        context,
        objection: repQuestion.trim(),
        action,
        existing_response: result.recommendedResponse,
      });
      setResult((prev) => ({ ...prev, recommendedResponse: data.response || prev.recommendedResponse }));
    } catch (err) {
      setError(err.message || 'Failed to transform response.');
    } finally {
      setActionLoading(null);
    }
  }

  async function copyRec() {
    if (!result?.recommendedResponse) return;
    try {
      await navigator.clipboard.writeText(result.recommendedResponse);
      setCopiedRec(true);
      setTimeout(() => setCopiedRec(false), 2000);
    } catch { /* no-op */ }
  }

  async function copySoft() {
    if (!result?.softerVersion) return;
    try {
      await navigator.clipboard.writeText(result.softerVersion);
      setCopiedSoft(true);
      setTimeout(() => setCopiedSoft(false), 2000);
    } catch { /* no-op */ }
  }

  function selectChip(text) {
    setRepQuestion(text);
    setError(null);
  }

  const busy = loading || actionLoading !== null;

  return (
    <section className="intake-preview-panel__section intake-preview-panel__section--compact">
      <div className="objection-assist">
        <div className="objection-assist__header">
          <MessageSquare size={14} className="objection-assist__header-icon" />
          <span className="objection-assist__header-title">Objection Assistant</span>
          <Sparkles size={11} className="objection-assist__header-sparkle" />
        </div>

        <div className="objection-assist__chips">
          {QUICK_OBJECTIONS.map((q) => (
            <button
              key={q.key}
              type="button"
              onClick={() => selectChip(q.text)}
              className={`objection-assist__chip${repQuestion === q.text ? ' objection-assist__chip--active' : ''}`}
            >
              {q.label}
            </button>
          ))}
        </div>

        <input
          className="intake-input objection-assist__input"
          placeholder="What did the customer say?"
          value={repQuestion}
          onChange={(e) => { setRepQuestion(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) generate(); }}
          disabled={busy}
        />

        <button
          type="button"
          className="intake-primary-btn objection-assist__generate-btn"
          onClick={generate}
          disabled={!repQuestion.trim() || busy}
        >
          {loading
            ? <><Loader2 size={13} className="animate-spin" /> Generating...</>
            : <><Sparkles size={13} /> Get Sales Response</>
          }
        </button>

        {error && (
          <p className="objection-assist__error">{error}</p>
        )}

        {result && (
          <div className="objection-result">
            {/* Recommended Response */}
            <div className="objection-result__section objection-result__section--primary">
              <div className="objection-result__header">
                <span className="objection-result__label">Recommended Response</span>
                <button
                  type="button"
                  className={`objection-assist__copy-btn${copiedRec ? ' objection-assist__copy-btn--done' : ''}`}
                  onClick={copyRec}
                  title="Copy recommended response"
                >
                  {copiedRec
                    ? <><ClipboardCheck size={11} /> Copied</>
                    : <><Clipboard size={11} /> Copy</>
                  }
                </button>
              </div>
              <textarea
                className="objection-assist__response"
                value={result.recommendedResponse}
                onChange={(e) => {
                  setResult((prev) => ({ ...prev, recommendedResponse: e.target.value }));
                  setCopiedRec(false);
                }}
                rows={5}
              />
              <div className="objection-assist__action-row">
                <div className="objection-assist__actions">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      className="objection-assist__action-btn"
                      onClick={() => runAction(a.key)}
                      disabled={busy}
                    >
                      {actionLoading === a.key
                        ? <Loader2 size={10} className="animate-spin" />
                        : null
                      }
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sales Angle */}
            {result.salesAngle && (
              <div className="objection-result__section objection-result__section--angle">
                <div className="objection-result__header">
                  <span className="objection-result__label">Sales Angle</span>
                  <span className="objection-result__badge">Rep coaching</span>
                </div>
                <p className="objection-result__coaching">{result.salesAngle}</p>
              </div>
            )}

            {/* Softer Version */}
            {result.softerVersion && (
              <div className="objection-result__section objection-result__section--softer">
                <div className="objection-result__header">
                  <span className="objection-result__label">Softer Version</span>
                  <button
                    type="button"
                    className={`objection-assist__copy-btn${copiedSoft ? ' objection-assist__copy-btn--done' : ''}`}
                    onClick={copySoft}
                    title="Copy softer version"
                  >
                    {copiedSoft
                      ? <><ClipboardCheck size={11} /> Copied</>
                      : <><Clipboard size={11} /> Copy</>
                    }
                  </button>
                </div>
                <p className="objection-result__softer">{result.softerVersion}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
