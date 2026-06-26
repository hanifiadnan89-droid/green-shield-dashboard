import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OUTCOMES, REASONS, OUTCOME_EMOJI } from './constants.js';

export default function ObjectionCoachOutcome({ onSave, saved, saving }) {
  const [outcome,     setOutcome]     = useState('');
  const [reason,      setReason]      = useState('');
  const [saleValue,   setSaleValue]   = useState('');
  const [whyItWorked, setWhyItWorked] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const handleSave = async () => {
    if (!outcome || saving || saved) return;
    await onSave({ outcome, outcomeReason: reason || null, saleValue, whyItWorked: whyItWorked.trim() || null });
  };

  if (saved) {
    return (
      <span className="oc-outcome-saved">
        {OUTCOME_EMOJI[outcome] ?? '✓'} Outcome saved — this helps improve future coaching
      </span>
    );
  }

  return (
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

      <div className="oc-outcome-row2">
        <button
          type="button"
          className="oc-add-details"
          onClick={() => setShowDetails(v => !v)}
        >
          {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showDetails ? 'Hide' : 'Add'} details
        </button>
        <button
          type="button"
          className="oc-save-outcome"
          disabled={!outcome || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save Outcome'}
        </button>
      </div>

      {showDetails && (
        <div className="oc-outcome-details">
          <input
            className="oc-input"
            type="number"
            placeholder="Sale value (optional)"
            value={saleValue}
            onChange={e => setSaleValue(e.target.value)}
          />
          <textarea
            className="oc-input"
            rows={2}
            placeholder="What worked or didn't work? (helps train future responses)"
            value={whyItWorked}
            onChange={e => setWhyItWorked(e.target.value)}
          />
        </div>
      )}
    </>
  );
}
