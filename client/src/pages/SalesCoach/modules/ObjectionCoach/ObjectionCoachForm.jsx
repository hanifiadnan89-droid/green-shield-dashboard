import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { CATEGORIES, SERVICES, PERSONALITIES } from './constants.js';

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="oc-chips">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          className={`oc-chip${value === opt.id ? ' oc-chip--active' : ''}`}
          onClick={() => onChange(value === opt.id ? '' : opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function ObjectionCoachForm({ onSubmit, loading, error }) {
  const [situation,    setSituation]    = useState('');
  const [category,     setCategory]     = useState('');
  const [service,      setService]      = useState('');
  const [personality,  setPersonality]  = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [propAddress,  setPropAddress]  = useState('');
  const [propType,     setPropType]     = useState('');
  const [propNotes,    setPropNotes]    = useState('');

  const canSubmit = situation.trim().length >= 10;

  const handleSubmit = () => {
    if (!canSubmit || loading) return;
    onSubmit({ situation, category, service, personality, showOptional, propAddress, propType, propNotes });
  };

  return (
    <>
      <div className="oc-field">
        <label className="oc-field__label">What did the customer say?</label>
        <textarea
          className="oc-field__textarea"
          rows={4}
          placeholder="e.g. We already have a pest control company — or — It costs too much right now"
          value={situation}
          onChange={e => setSituation(e.target.value)}
        />
      </div>

      <div className="oc-field">
        <label className="oc-field__label">Objection Type</label>
        <ChipGroup options={CATEGORIES} value={category} onChange={setCategory} />
      </div>

      <div className="oc-field">
        <label className="oc-field__label">Service Being Discussed</label>
        <ChipGroup options={SERVICES} value={service} onChange={setService} />
      </div>

      <div className="oc-field">
        <label className="oc-field__label">Customer Vibe</label>
        <ChipGroup options={PERSONALITIES} value={personality} onChange={setPersonality} />
      </div>

      <div>
        <button
          type="button"
          className="oc-optional-toggle"
          onClick={() => setShowOptional(v => !v)}
        >
          {showOptional ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Property Context (Optional)
        </button>
        {showOptional && (
          <div className="oc-optional-fields">
            <input
              className="oc-input"
              type="text"
              placeholder="Property address"
              value={propAddress}
              onChange={e => setPropAddress(e.target.value)}
            />
            <input
              className="oc-input"
              type="text"
              placeholder="Property type (single family, townhome, etc.)"
              value={propType}
              onChange={e => setPropType(e.target.value)}
            />
            <textarea
              className="oc-input"
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
        onClick={handleSubmit}
      >
        {loading ? (
          <>
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
            Coaching…
          </>
        ) : (
          <>&#x1F9E0; Coach Me</>
        )}
      </button>

      {error && (
        <div className="oc-error">
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}
    </>
  );
}
