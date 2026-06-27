import { useState } from 'react';
import {
  Brain, MessageSquare, ShieldCheck, Bug, Smile,
  ChevronDown, ChevronUp, AlertCircle,
  DollarSign, Clock, XCircle, Users, User, MoreHorizontal,
  Leaf, Package, HelpCircle, Check,
  BarChart2, MessageCircle, Timer, Tag,
} from 'lucide-react';
import { CATEGORIES, SERVICES, PERSONALITIES } from './constants.js';

const CATEGORY_ICONS = {
  price:      DollarSign,
  timing:     Clock,
  need:       XCircle,
  trust:      ShieldCheck,
  competitor: Users,
  think:      User,
  other:      MoreHorizontal,
};

const SERVICE_ICONS = {
  mosquito:     Leaf,
  flea_tick:    Bug,
  general_pest: Bug,
  bundle:       Package,
  not_sure:     HelpCircle,
};

const PERSONALITY_ICONS = {
  analytical:    BarChart2,
  friendly:      MessageCircle,
  skeptical:     Brain,
  rushed:        Timer,
  price_focused: Tag,
};

function SectionHeader({ icon: Icon, title, step }) {
  return (
    <div className="oc-section-header">
      <div className="oc-step-badge">
        {step ?? <Icon size={16} />}
      </div>
      <span className="oc-section-title">{title}</span>
    </div>
  );
}

function OptionGrid({ options, value, onChange, icons }) {
  return (
    <div className="oc-option-grid">
      {options.map(opt => {
        const Icon = icons[opt.id];
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            className={`oc-option-card${active ? ' oc-option-card--active' : ''}`}
            onClick={() => onChange(active ? '' : opt.id)}
          >
            {Icon && <Icon size={14} />}
            {opt.label}
            {active && <Check className="oc-option-card__check" size={15} />}
          </button>
        );
      })}
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

  const MAX_CHARS  = 400;
  const canSubmit  = situation.trim().length >= 10;

  const handleSubmit = () => {
    if (!canSubmit || loading) return;
    onSubmit({ situation, category, service, personality, showOptional, propAddress, propType, propNotes });
  };

  return (
    <div className="oc-form-card">

      <div className="oc-form-section">
        <SectionHeader icon={MessageSquare} title="Customer Objection" step={1} />
        <textarea
          className="oc-form-textarea"
          rows={5}
          maxLength={MAX_CHARS}
          placeholder="Type exactly what the customer said..."
          value={situation}
          onChange={e => setSituation(e.target.value)}
        />
        <div className="oc-char-counter">{situation.length} / {MAX_CHARS}</div>
      </div>

      <div className="oc-form-divider" />

      {/* ── Service Being Discussed ── */}
      <div className="oc-form-section">
        <SectionHeader icon={Leaf} title="Service Being Discussed" step={2} />
        <OptionGrid options={SERVICES} value={service} onChange={setService} icons={SERVICE_ICONS} />
      </div>

      <div className="oc-form-divider" />

      {/* ── Objection Type ── */}
      <div className="oc-form-section">
        <SectionHeader icon={ShieldCheck} title="Objection Type" step={3} />
        <OptionGrid options={CATEGORIES} value={category} onChange={setCategory} icons={CATEGORY_ICONS} />
      </div>

      <div className="oc-form-divider" />

      {/* ── Submit ── */}
      <div className="oc-form-section oc-form-section--submit">
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
            <>
              <Brain size={18} />
              Coach Me
            </>
          )}
        </button>

        {error && (
          <div className="oc-error">
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}
      </div>

      {/* ── Customer Vibe ── */}
      <div className="oc-form-section">
        <SectionHeader icon={Smile} title="Customer Personality/Vibe" step={4} />
        <select
          className="oc-input oc-compact-select"
          value={personality}
          onChange={e => setPersonality(e.target.value)}
        >
          <option value="">Select customer vibe</option>
          {PERSONALITIES.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="oc-form-divider" />

      {/* ── Property Context ── */}
      <div className="oc-form-section oc-form-section--property">
        <button
          type="button"
          className="oc-property-toggle"
          onClick={() => setShowOptional(v => !v)}
        >
          <div className="oc-step-badge oc-step-badge--muted">
            {showOptional ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
          <div className="oc-property-toggle__text">
            <span className="oc-section-title">Property Context</span>
            <span className="oc-property-badge">Optional</span>
            {!showOptional && (
              <p className="oc-property-hint">Add details about the property or situation</p>
            )}
          </div>
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

    </div>
  );
}
