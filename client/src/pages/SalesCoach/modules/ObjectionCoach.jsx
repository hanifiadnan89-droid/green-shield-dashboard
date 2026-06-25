import { useState } from 'react';
import {
  Copy, Check, ChevronDown, ChevronUp,
  ThumbsUp, ThumbsDown, Star, AlertCircle, MessageSquare,
} from 'lucide-react';
import { api } from '../../../api/client.js';

/* ── Static options ──────────────────────────────────────────────────────── */

const CATEGORIES = [
  { id: 'price', label: 'Price / Cost' },
  { id: 'timing', label: 'Timing / Not Now' },
  { id: 'need', label: "Don't Need It" },
  { id: 'trust', label: 'Trust / Skepticism' },
  { id: 'competitor', label: 'Already Have Service' },
  { id: 'think', label: 'Need to Think / Spouse' },
  { id: 'other', label: 'Other' },
];

const SERVICES = [
  { id: 'mosquito', label: 'Mosquito' },
  { id: 'flea_tick', label: 'Flea & Tick' },
  { id: 'general_pest', label: 'General Pest' },
  { id: 'bundle', label: 'Bundle' },
  { id: 'not_sure', label: 'Not Sure Yet' },
];

const PERSONALITIES = [
  { id: 'analytical', label: 'Analytical' },
  { id: 'friendly', label: 'Friendly / Chatty' },
  { id: 'skeptical', label: 'Skeptical' },
  { id: 'rushed', label: 'In a Rush' },
  { id: 'price_focused', label: 'Price-Focused' },
];

const OUTCOMES = [
  { id: 'sold', label: 'Sold' },
  { id: 'scheduled', label: 'Appointment Scheduled' },
  { id: 'follow_up', label: 'Follow-up Planned' },
  { id: 'lost', label: 'Lost — Customer Declined' },
  { id: 'unknown', label: 'Unknown / Still Open' },
];

const REASONS = [
  { id: 'great_response', label: 'Response landed perfectly' },
  { id: 'price_overcome', label: 'Overcame price objection' },
  { id: 'built_trust', label: 'Built trust / credibility' },
  { id: 'compelling_close', label: 'Compelling closing question' },
  { id: 'wrong_approach', label: 'Wrong approach for this customer' },
  { id: 'too_pushy', label: 'Too pushy / aggressive' },
  { id: 'price_too_high', label: 'Price was genuinely too high' },
  { id: 'timing', label: 'Bad timing — not ready' },
  { id: 'other', label: 'Other reason' },
];

/* ── Chip component ──────────────────────────────────────────────────────── */

function ChipGroup({ options, value, onChange, multi = false }) {
  const toggle = (id) => {
    if (multi) {
      onChange(value === id ? '' : id);
    } else {
      onChange(value === id ? '' : id);
    }
  };
  return (
    <div className="oc-chips">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          className={`oc-chip ${value === opt.id ? 'oc-chip--active' : ''}`}
          onClick={() => toggle(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── Result section ──────────────────────────────────────────────────────── */

function ResultSection({ variant, label, children }) {
  return (
    <div className={`oc-result-section oc-result-section--${variant}`}>
      <div className="oc-result-label">{label}</div>
      {children}
    </div>
  );
}

/* ── Copy button ─────────────────────────────────────────────────────────── */

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    });
  };
  return (
    <button
      type="button"
      className={`oc-copy-btn ${done ? 'oc-copy-btn--done' : ''}`}
      onClick={copy}
    >
      {done ? <Check size={11} /> : <Copy size={11} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function ObjectionCoach() {
  /* Form state */
  const [situation, setSituation] = useState('');
  const [category, setCategory] = useState('');
  const [service, setService] = useState('');
  const [personality, setPersonality] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [propAddress, setPropAddress] = useState('');
  const [propType, setPropType] = useState('');
  const [propNotes, setPropNotes] = useState('');

  /* Request state */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [repEdited, setRepEdited] = useState('');

  /* Feedback state */
  const [feedbackType, setFeedbackType] = useState(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  /* Outcome state */
  const [outcome, setOutcome] = useState('');
  const [outcomeReason, setOutcomeReason] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const [whyItWorked, setWhyItWorked] = useState('');
  const [showOutcomeDetails, setShowOutcomeDetails] = useState(false);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [outcomeSaved, setOutcomeSaved] = useState(false);

  const canSubmit = situation.trim().length >= 10;

  const resetFeedbackOutcome = () => {
    setFeedbackType(null);
    setShowCorrection(false);
    setCorrection('');
    setFeedbackSaved(false);
    setOutcome('');
    setOutcomeReason('');
    setSaleValue('');
    setWhyItWorked('');
    setShowOutcomeDetails(false);
    setOutcomeSaved(false);
  };

  const coach = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    resetFeedbackOutcome();
    setRepEdited('');
    try {
      const body = {
        mode: 'coachObjection',
        situation: situation.trim(),
        category,
        service,
        personality,
        propertyContext: showOptional ? {
          address: propAddress.trim(),
          propertyType: propType.trim(),
          notes: propNotes.trim(),
        } : {},
        leadContext: {},
      };
      const data = await api.ai.coachObjection(body);
      setResult(data);
      setRepEdited(data.recommendedResponse ?? '');
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (type) => {
    if (feedbackSaved || feedbackSaving) return;
    const finalType = type;
    setFeedbackType(finalType);
    if (finalType === 'thumbs_down') {
      setShowCorrection(true);
      return;
    }
    setFeedbackSaving(true);
    try {
      await api.ai.objectionFeedback({
        repQuestion: situation.trim(),
        recommendedResponse: result.recommendedResponse,
        feedbackType: finalType === 'thumbs_up' ? 'thumbs_up' : 'save_approved',
        serviceType: service,
        propertyContext: showOptional ? { address: propAddress, propertyType: propType } : {},
      });
      setFeedbackSaved(true);
    } catch (_) {
      /* silent */
    } finally {
      setFeedbackSaving(false);
    }
  };

  const submitCorrection = async () => {
    if (feedbackSaved || feedbackSaving) return;
    setFeedbackSaving(true);
    try {
      await api.ai.objectionFeedback({
        repQuestion: situation.trim(),
        recommendedResponse: result.recommendedResponse,
        feedbackType: 'thumbs_down',
        correction: correction.trim(),
        serviceType: service,
        propertyContext: showOptional ? { address: propAddress, propertyType: propType } : {},
      });
      setFeedbackSaved(true);
      setShowCorrection(false);
    } catch (_) {
      /* silent */
    } finally {
      setFeedbackSaving(false);
    }
  };

  const saveOutcome = async () => {
    if (outcomeSaved || outcomeSaving || !outcome) return;
    setOutcomeSaving(true);
    try {
      await api.ai.objectionOutcome({
        repQuestion: situation.trim(),
        customerObjection: situation.trim(),
        serviceType: service,
        recommendedResponse: result.recommendedResponse,
        softerVersion: result.softerVersion,
        repEditedResponse: repEdited !== result.recommendedResponse ? repEdited : undefined,
        outcome,
        outcomeReason: outcomeReason || undefined,
        saleValue: saleValue ? Number(saleValue) : undefined,
        whyItWorked: whyItWorked.trim() || undefined,
        propertyContext: showOptional ? { address: propAddress, propertyType: propType } : {},
      });
      setOutcomeSaved(true);
    } catch (_) {
      /* silent */
    } finally {
      setOutcomeSaving(false);
    }
  };

  const confidenceLevel = result
    ? result.confidence >= 75 ? 'high' : result.confidence >= 50 ? 'medium' : 'low'
    : null;

  const OUTCOME_EMOJI = {
    sold: '🎉',
    scheduled: '📅',
    follow_up: '📞',
    lost: '😔',
    unknown: '🔄',
  };

  return (
    <div className="oc-workspace">
      {/* ── Left: Form panel ── */}
      <div className="oc-form-panel">
        <div className="oc-form">
          {/* Situation */}
          <div>
            <label className="oc-section__label">What did the customer say?</label>
            <textarea
              className="oc-section__textarea"
              rows={4}
              placeholder="e.g. We already have a pest control company — or — It costs too much right now"
              value={situation}
              onChange={e => setSituation(e.target.value)}
            />
          </div>

          {/* Category */}
          <div>
            <label className="oc-section__label">Objection Type</label>
            <ChipGroup options={CATEGORIES} value={category} onChange={setCategory} />
          </div>

          {/* Service */}
          <div>
            <label className="oc-section__label">Service Being Discussed</label>
            <ChipGroup options={SERVICES} value={service} onChange={setService} />
          </div>

          {/* Personality */}
          <div>
            <label className="oc-section__label">Customer Vibe</label>
            <ChipGroup options={PERSONALITIES} value={personality} onChange={setPersonality} />
          </div>

          {/* Optional property context */}
          <div>
            <button
              type="button"
              className="oc-optional-toggle"
              onClick={() => setShowOptional(v => !v)}
            >
              {showOptional ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showOptional ? 'Hide' : 'Add'} property context (optional)
            </button>
            {showOptional && (
              <div className="oc-optional-fields">
                <input
                  className="oc-optional-input"
                  type="text"
                  placeholder="Property address"
                  value={propAddress}
                  onChange={e => setPropAddress(e.target.value)}
                />
                <input
                  className="oc-optional-input"
                  type="text"
                  placeholder="Property type (single family, townhome, etc.)"
                  value={propType}
                  onChange={e => setPropType(e.target.value)}
                />
                <textarea
                  className="oc-optional-input"
                  rows={2}
                  placeholder="Any relevant property notes…"
                  value={propNotes}
                  onChange={e => setPropNotes(e.target.value)}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            className="oc-submit"
            disabled={!canSubmit || loading}
            onClick={coach}
          >
            {loading ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                Coaching…
              </>
            ) : (
              <>🧠 Coach Me</>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Result panel ── */}
      <div className="oc-result-panel">
        {!result && !loading && (
          <div className="oc-empty">
            <div className="oc-empty__icon"><MessageSquare size={40} /></div>
            <div className="oc-empty__title">Ready when you are</div>
            <div className="oc-empty__hint">
              Describe what the customer said, pick a category, and hit Coach Me to get a live sales response.
            </div>
          </div>
        )}

        {loading && (
          <div className="oc-empty">
            <div className="animate-spin w-8 h-8 border-2 border-green-200 border-t-green-600 rounded-full mb-4" />
            <div className="oc-empty__title">Building your response…</div>
            <div className="oc-empty__hint">Pulling from strategy, examples, and outcomes</div>
          </div>
        )}

        {result && (
          <div className="oc-results">
            {/* Header row: confidence badge */}
            <div className="oc-result-header">
              <span className="text-xs font-semibold text-gs-muted">Coaching Result</span>
              {result.confidence != null && (
                <span className={`oc-confidence-badge oc-confidence-badge--${confidenceLevel}`}>
                  {confidenceLevel === 'high' ? '✓' : confidenceLevel === 'medium' ? '~' : '?'}
                  {' '}{result.confidence}% Confidence
                </span>
              )}
            </div>

            {/* 1. Recommended Response */}
            <ResultSection variant="response" label="Recommended Response">
              <div className="oc-result-header">
                <span />
                <CopyBtn text={repEdited || result.recommendedResponse} />
              </div>
              <textarea
                className="oc-result-response"
                rows={5}
                value={repEdited}
                onChange={e => setRepEdited(e.target.value)}
              />
            </ResultSection>

            {/* 2. Why This Works */}
            {result.whyThisWorks && (
              <ResultSection variant="why" label="Why This Works">
                <p className="oc-result-text">{result.whyThisWorks}</p>
              </ResultSection>
            )}

            {/* 3. Sales Strategy */}
            {result.salesStrategy && (
              <ResultSection variant="strategy" label="Sales Strategy">
                <p className="oc-result-text">{result.salesStrategy}</p>
              </ResultSection>
            )}

            {/* 4. Softer Version */}
            {result.softerVersion && (
              <ResultSection variant="softer" label="Alternative — Softer Version">
                <div className="oc-result-header">
                  <span />
                  <CopyBtn text={result.softerVersion} />
                </div>
                <p className="oc-result-text">{result.softerVersion}</p>
              </ResultSection>
            )}

            {/* 5. Best Closing Question */}
            {result.bestClosingQuestion && (
              <ResultSection variant="closing" label="Best Closing Question">
                <div className="oc-result-header">
                  <span />
                  <CopyBtn text={result.bestClosingQuestion} />
                </div>
                <p className="oc-result-text">{result.bestClosingQuestion}</p>
              </ResultSection>
            )}

            {/* 6. Things To Avoid */}
            {result.thingsToAvoid?.length > 0 && (
              <ResultSection variant="avoid" label="Things To Avoid">
                <ul className="oc-avoid-list">
                  {result.thingsToAvoid.map((item, i) => (
                    <li key={i} className="oc-avoid-item">{item}</li>
                  ))}
                </ul>
              </ResultSection>
            )}

            {/* ── Feedback ── */}
            <div className="oc-outcome-section">
              <div className="oc-outcome-title">Was this helpful?</div>
              {!feedbackSaved ? (
                <div className="oc-feedback-row">
                  <button
                    type="button"
                    className={`oc-feedback-btn oc-feedback-btn--up ${feedbackType === 'thumbs_up' ? 'border-green-300 bg-green-50 text-green-700' : ''}`}
                    disabled={feedbackSaving}
                    onClick={() => submitFeedback('thumbs_up')}
                  >
                    <ThumbsUp size={11} /> Helpful
                  </button>
                  <button
                    type="button"
                    className={`oc-feedback-btn oc-feedback-btn--down ${feedbackType === 'thumbs_down' ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
                    disabled={feedbackSaving}
                    onClick={() => submitFeedback('thumbs_down')}
                  >
                    <ThumbsDown size={11} /> Not Helpful
                  </button>
                  <button
                    type="button"
                    className={`oc-feedback-btn oc-feedback-btn--star ${feedbackType === 'save_approved' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' : ''}`}
                    disabled={feedbackSaving}
                    onClick={() => submitFeedback('save_approved')}
                  >
                    <Star size={11} /> Save as Example
                  </button>
                </div>
              ) : (
                <span className="oc-outcome-saved">✓ Feedback saved — thanks!</span>
              )}

              {showCorrection && !feedbackSaved && (
                <div className="flex flex-col gap-2 mt-2">
                  <textarea
                    className="oc-section__textarea"
                    rows={3}
                    placeholder="What would a better response look like? (optional but very helpful)"
                    value={correction}
                    onChange={e => setCorrection(e.target.value)}
                    style={{ minHeight: 64 }}
                  />
                  <button
                    type="button"
                    className="oc-outcome-save"
                    disabled={feedbackSaving}
                    onClick={submitCorrection}
                  >
                    {feedbackSaving ? 'Saving…' : 'Submit Feedback'}
                  </button>
                </div>
              )}
            </div>

            {/* ── Outcome tracking ── */}
            <div className="oc-outcome-section">
              <div className="oc-outcome-title">Track the Outcome</div>
              {!outcomeSaved ? (
                <>
                  <div className="oc-outcome-selects">
                    <select
                      className="oc-outcome-select"
                      value={outcome}
                      onChange={e => setOutcome(e.target.value)}
                    >
                      <option value="">What happened?</option>
                      {OUTCOMES.map(o => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                    <select
                      className="oc-outcome-select"
                      value={outcomeReason}
                      onChange={e => setOutcomeReason(e.target.value)}
                    >
                      <option value="">Why? (optional)</option>
                      {REASONS.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="oc-optional-toggle mb-2"
                    onClick={() => setShowOutcomeDetails(v => !v)}
                  >
                    {showOutcomeDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {showOutcomeDetails ? 'Hide' : 'Add'} details
                  </button>

                  {showOutcomeDetails && (
                    <div className="oc-optional-fields mb-2">
                      <input
                        className="oc-optional-input"
                        type="number"
                        placeholder="Sale value (optional)"
                        value={saleValue}
                        onChange={e => setSaleValue(e.target.value)}
                      />
                      <textarea
                        className="oc-optional-input"
                        rows={2}
                        placeholder="What worked or didn't work? (helps train future responses)"
                        value={whyItWorked}
                        onChange={e => setWhyItWorked(e.target.value)}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className="oc-outcome-save"
                    disabled={!outcome || outcomeSaving}
                    onClick={saveOutcome}
                  >
                    {outcomeSaving ? 'Saving…' : 'Save Outcome'}
                  </button>
                </>
              ) : (
                <span className="oc-outcome-saved">
                  {OUTCOME_EMOJI[outcome] || '✓'} Outcome saved — this helps improve future coaching
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
