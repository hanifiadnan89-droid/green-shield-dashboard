import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  AlertCircle, ArrowRight, BarChart2, Brain, Bug, ChevronDown, ChevronUp,
  DollarSign, HelpCircle, Leaf, MessageCircle, Package,
  ShieldCheck, Smile, Tag, Timer, Users, User,
} from 'lucide-react';
import PremiumSelect from '../../components/PremiumSelect.jsx';
import { CATEGORIES, SERVICES, PERSONALITIES } from './constants.js';

const CATEGORY_ICONS = {
  price: DollarSign, trust: ShieldCheck, think: User, shopping: Users,
};
const SERVICE_ICONS = {
  tick_mosquito: Leaf, insect_quarterly: Bug, rodent_insect_triannual: Bug,
  bed_bug: Bug, commercial_monthly: Package, commercial_bimonthly: Package,
  commercial_quarterly: Package, commercial_triannual: Package,
  commercial_custom: Package, residential_custom: HelpCircle,
};
const PERSONALITY_ICONS = {
  analytical: BarChart2, friendly: MessageCircle, skeptical: Brain,
  rushed: Timer, price_focused: Tag,
};

const MAX_CHARS = 400;
const MIN_CHARS = 10;

const ObjectionCoachForm = forwardRef(function ObjectionCoachForm(
  { onSubmit, onCategoryChange, loading, error },
  ref,
) {
  const [situation,    setSituation]    = useState('');
  const [category,     setCategory]     = useState('');
  const [service,      setService]      = useState('');
  const [personality,  setPersonality]  = useState('');
  const [showCtx,      setShowCtx]      = useState(false);
  const [propAddress,  setPropAddress]  = useState('');
  const [propType,     setPropType]     = useState('');
  const [propNotes,    setPropNotes]    = useState('');

  const handleCategoryChange = (next) => {
    setCategory(next);
    onCategoryChange?.(next);
  };

  const textareaRef = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [situation]);

  // Imperative hook so parent can prefill from Recent Objections
  useImperativeHandle(ref, () => ({
    prefill: (next = {}) => {
      if (typeof next.situation === 'string')   setSituation(next.situation);
      if (typeof next.category === 'string')    handleCategoryChange(next.category || '');
      if (typeof next.service === 'string')     setService(next.service || '');
      if (typeof next.personality === 'string') setPersonality(next.personality || '');
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    focusTextarea: () => textareaRef.current?.focus(),
    reset: () => {
      setSituation('');
      handleCategoryChange('');
      setService(''); setPersonality('');
      setPropAddress(''); setPropType(''); setPropNotes(''); setShowCtx(false);
    },
  }), []);  // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = situation.trim().length >= MIN_CHARS && !loading;

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      situation, category, service, personality,
      showOptional: showCtx,
      propAddress, propType, propNotes,
    });
  };

  // Cmd/Ctrl + Enter submits
  const handleKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e);
  };

  const remaining = MAX_CHARS - situation.length;

  return (
    <form className="oc-composer" onSubmit={handleSubmit}>
      <div className="oc-composer__field">
        <label className="oc-composer__label" htmlFor="oc-situation">
          Customer Objection
          <span className="oc-composer__counter" aria-live="polite">
            {remaining < 60
              ? <span className={remaining < 0 ? 'is-over' : 'is-low'}>{remaining} left</span>
              : <span>{situation.length} / {MAX_CHARS}</span>}
          </span>
        </label>
        <textarea
          id="oc-situation"
          ref={textareaRef}
          className="oc-composer__textarea"
          rows={2}
          maxLength={MAX_CHARS}
          placeholder="Type exactly what the customer said…"
          value={situation}
          onChange={e => setSituation(e.target.value)}
          onKeyDown={handleKey}
        />
      </div>

      <div className="oc-composer__selects">
        <PremiumSelect
          value={service}
          onChange={setService}
          options={SERVICES}
          icons={SERVICE_ICONS}
          icon={Leaf}
          placeholder="Service"
        />
        <PremiumSelect
          value={category}
          onChange={handleCategoryChange}
          options={CATEGORIES}
          icons={CATEGORY_ICONS}
          icon={ShieldCheck}
          placeholder="Objection type"
          searchable
        />
        <PremiumSelect
          value={personality}
          onChange={setPersonality}
          options={PERSONALITIES}
          icons={PERSONALITY_ICONS}
          icon={Smile}
          placeholder="Personality"
        />
      </div>

      <button
        type="button"
        className="oc-composer__ctx-toggle"
        onClick={() => setShowCtx(v => !v)}
        aria-expanded={showCtx}
      >
        {showCtx
          ? <ChevronUp size={13} aria-hidden="true" />
          : <ChevronDown size={13} aria-hidden="true" />}
        {showCtx ? 'Hide property context' : 'Add property context'}
        <span className="oc-composer__ctx-meta">Optional</span>
      </button>

      {showCtx && (
        <div className="oc-composer__ctx">
          <input
            className="oc-composer__input"
            type="text"
            placeholder="Property address"
            aria-label="Property address"
            autoComplete="off"
            spellCheck="false"
            value={propAddress}
            onChange={e => setPropAddress(e.target.value)}
          />
          <input
            className="oc-composer__input"
            type="text"
            placeholder="Property type (single family, townhome…)"
            aria-label="Property type"
            autoComplete="off"
            value={propType}
            onChange={e => setPropType(e.target.value)}
          />
          <textarea
            className="oc-composer__input oc-composer__input--textarea"
            rows={2}
            placeholder="Any relevant property notes…"
            aria-label="Property notes"
            value={propNotes}
            onChange={e => setPropNotes(e.target.value)}
          />
        </div>
      )}

      <button
        type="submit"
        className="oc-composer__cta"
        disabled={!canSubmit}
      >
        {loading ? (
          <>
            <span className="oc-composer__spinner" aria-hidden="true" />
            Coaching…
          </>
        ) : (
          <>
            <Brain size={16} aria-hidden="true" />
            Coach Me
            <ArrowRight size={15} className="oc-composer__cta-arrow" aria-hidden="true" />
          </>
        )}
      </button>

      {error && (
        <div className="oc-composer__error" role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </div>
      )}
    </form>
  );
});

export default ObjectionCoachForm;
