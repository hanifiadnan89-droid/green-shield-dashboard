import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Bookmark, BookOpen, Check, Copy, Lightbulb,
  Sparkles, Target, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import { salesCoachApi } from '../../api/salesCoachApi.js';

const SAVED_KEY = 'oc.savedResponses';

function saveLocal(entry) {
  try {
    const prev = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    const next = [entry, ...prev.filter(p => p.id !== entry.id)].slice(0, 50);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch { /* localStorage may be unavailable */ }
}

function ActionButton({ icon: Icon, label, onClick, active, variant = 'ghost', srLabel }) {
  return (
    <button
      type="button"
      className={`oc-action oc-action--${variant}${active ? ' oc-action--active' : ''}`}
      onClick={onClick}
      aria-label={srLabel || label}
      aria-pressed={active || undefined}
      title={label}
    >
      <Icon size={14} aria-hidden="true" />
      <span className="oc-action__label">{label}</span>
    </button>
  );
}

export default function ObjectionCoachResult({
  result, repEdited, onRepEditedChange,
  isPlaceholder = false, sessionId = null, repQuestion = '',
}) {
  const knowledgeSources = Array.isArray(result.knowledgeSources) ? result.knowledgeSources : [];
  const confidence = typeof result.confidence === 'number' ? Math.round(result.confidence) : 92;
  const whyItems = result.whyThisWorks
    ? result.whyThisWorks.split(/(?<=\.)\s+/).filter(Boolean).slice(0, 4)
    : ['Acknowledges the concern', 'Reframes around value', 'Sets up a confident close'];
  const closingQuestion = result.bestClosingQuestion || 'If the plan solves the real problem and fits the property, would you be comfortable moving forward today?';
  const avoidItems = result.thingsToAvoid?.length
    ? result.thingsToAvoid
    : ["Don't argue", "Don't discount before explaining value", "Don't over-explain"];

  // Action state
  const [copyDone, setCopyDone]   = useState(false);
  const [saved, setSaved]         = useState(false);
  const [vote, setVote]           = useState(null); // 'up' | 'down' | null
  const responseRef = useRef(null);
  const text = repEdited || result.recommendedResponse || '';

  // Auto-grow the editable response so the whole thing is visible
  useEffect(() => {
    const el = responseRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Reset vote/saved when a new result comes in
  useEffect(() => {
    setVote(null);
    setSaved(false);
    setCopyDone(false);
  }, [result?.recommendedResponse]);

  const handleCopy = () => {
    if (isPlaceholder || !text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1800);
    });
  };

  const handleSave = () => {
    if (isPlaceholder) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    saveLocal({
      id, savedAt: new Date().toISOString(),
      response: text, repQuestion, confidence, sessionId,
    });
    setSaved(true);
    // Best-effort backend persistence — feedback endpoint already supports this type
    if (repQuestion?.trim()) {
      salesCoachApi.saveFeedback({
        repQuestion,
        recommendedResponse: text,
        salesAngle:    result.salesStrategy || '',
        softerVersion: result.softerVersion || '',
        feedbackType: 'save_approved',
        sessionId,
      }).catch(() => { /* ok — local copy persisted */ });
    }
    setTimeout(() => setSaved(false), 2400);
  };

  const sendVote = (type) => {
    if (isPlaceholder) return;
    const prev = vote;
    const next = prev === type ? null : type;
    setVote(next);
    if (!next || !repQuestion?.trim()) return;
    salesCoachApi.saveFeedback({
      repQuestion,
      recommendedResponse: text,
      salesAngle:    result.salesStrategy || '',
      softerVersion: result.softerVersion || '',
      feedbackType: next === 'up' ? 'thumbs_up' : 'thumbs_down',
      sessionId,
    }).catch(() => { /* silent — UI already updated */ });
  };

  return (
    <article className={`oc-answer${isPlaceholder ? ' oc-answer--placeholder' : ''}`}>
      <header className="oc-answer__head">
        <div className="oc-answer__heading">
          <span className="oc-answer__dot" aria-hidden="true" />
          <Sparkles size={14} className="oc-answer__icon" aria-hidden="true" />
          <span>Recommended Response</span>
        </div>
        <div className="oc-answer__actions" role="toolbar" aria-label="Response actions">
          <ActionButton
            icon={copyDone ? Check : Copy}
            label={copyDone ? 'Copied' : 'Copy'}
            onClick={handleCopy}
            active={copyDone}
            variant={copyDone ? 'success' : 'ghost'}
          />
          <ActionButton
            icon={Bookmark}
            label={saved ? 'Saved' : 'Save'}
            onClick={handleSave}
            active={saved}
            variant={saved ? 'success' : 'ghost'}
          />
          <ActionButton
            icon={ThumbsUp}
            label="Good"
            srLabel="Mark response as helpful"
            onClick={() => sendVote('up')}
            active={vote === 'up'}
            variant={vote === 'up' ? 'positive' : 'ghost'}
          />
          <ActionButton
            icon={ThumbsDown}
            label="Bad"
            srLabel="Mark response as not helpful"
            onClick={() => sendVote('down')}
            active={vote === 'down'}
            variant={vote === 'down' ? 'negative' : 'ghost'}
          />
        </div>
      </header>

      <div className="oc-answer__body">
        <textarea
          ref={responseRef}
          className="oc-answer__textarea"
          value={text}
          onChange={e => onRepEditedChange(e.target.value)}
          readOnly={isPlaceholder}
          spellCheck="false"
          aria-label="Recommended response (editable)"
        />
      </div>

      <footer className="oc-answer__footer">
        <div className="oc-answer__confidence" title={`AI confidence: ${confidence}%`}>
          <span className="oc-answer__confidence-label">Confidence</span>
          <div className="oc-answer__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(8, Math.min(100, confidence))}%` }} />
          </div>
          <span className="oc-answer__confidence-value">{confidence}%</span>
        </div>
        <div className="oc-answer__sources-meta">
          <BookOpen size={12} aria-hidden="true" />
          {knowledgeSources.length
            ? `${knowledgeSources.length} ${knowledgeSources.length === 1 ? 'source' : 'sources'}`
            : 'Green Shield knowledge'}
        </div>
      </footer>

      <section className="oc-insights">
        <div className="oc-insight oc-insight--why">
          <div className="oc-insight__head">
            <Lightbulb size={13} aria-hidden="true" />
            Why this works
          </div>
          <ul className="oc-insight__list">
            {whyItems.map((item, i) => (
              <li key={i}><Check size={12} aria-hidden="true" /><span>{item}</span></li>
            ))}
          </ul>
        </div>

        <div className="oc-insight oc-insight--closing">
          <div className="oc-insight__head">
            <Target size={13} aria-hidden="true" />
            Best closing question
          </div>
          <p className="oc-insight__quote">{closingQuestion}</p>
        </div>

        <div className="oc-insight oc-insight--avoid">
          <div className="oc-insight__head">
            <AlertTriangle size={13} aria-hidden="true" />
            Avoid
          </div>
          <ul className="oc-insight__list oc-insight__list--avoid">
            {avoidItems.slice(0, 4).map((item, i) => (
              <li key={i}><span className="oc-insight__x" aria-hidden="true">×</span><span>{item}</span></li>
            ))}
          </ul>
        </div>

        <div className="oc-insight oc-insight--sources">
          <div className="oc-insight__head">
            <BookOpen size={13} aria-hidden="true" />
            Knowledge used
          </div>
          {knowledgeSources.length > 0 ? (
            <ul className="oc-insight__sources">
              {knowledgeSources.slice(0, 4).map((s, i) => (
                <li key={`${s.id || s.title || 'src'}-${i}`}>
                  <span className="oc-insight__source-title">
                    {s.title || s.fileName || s.sourceUrl || 'Knowledge source'}
                  </span>
                  {typeof s.similarity === 'number' && (
                    <span className="oc-insight__source-pct">{Math.round(s.similarity * 100)}%</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="oc-insight__muted">Powered by Training Center, approved sales principles, and Green Shield playbooks.</p>
          )}
        </div>
      </section>
    </article>
  );
}
