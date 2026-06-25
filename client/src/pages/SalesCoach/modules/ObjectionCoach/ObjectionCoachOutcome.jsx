import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OUTCOMES, REASONS, OUTCOME_EMOJI } from './constants.js';

/**
 * Outcome tracking widget — records what happened after the coaching session.
 *
 * Props:
 *   onSave({ outcome, outcomeReason, saleValue, whyItWorked }) — async callback
 *   saved   — true when outcome was successfully saved
 *   saving  — true while save is in flight
 */
export default function ObjectionCoachOutcome({ onSave, saved, saving }) {
  const [outcome,      setOutcome]      = useState('');
  const [reason,       setReason]       = useState('');
  const [saleValue,    setSaleValue]    = useState('');
  const [whyItWorked,  setWhyItWorked]  = useState('');
  const [showDetails,  setShowDetails]  = useState(false);

  const handleSave = async () => {
    if (!outcome || saving || saved) return;
    await onSave({ outcome, outcomeReason: reason || null, saleValue, whyItWorked: whyItWorked.trim() || null });
  };

  const outcomeEmoji = OUTCOME_EMOJI[outcome] ?? '✓';

  return (
    <div className="oc-outcome-section">
      <div className="oc-outcome-title">Track the Outcome</div>

      {saved ? (
        <span className="oc-outcome-saved">
          {outcomeEmoji} Outcome saved — this helps improve future coaching
        </span>
      ) : (
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
              value={reason}
              onChange={e => setReason(e.target.value)}
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
            onClick={() => setShowDetails(v => !v)}
          >
            {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showDetails ? 'Hide' : 'Add'} details
          </button>

          {showDetails && (
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
            disabled={!outcome || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save Outcome'}
          </button>
        </>
      )}
    </div>
  );
}
