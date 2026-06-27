import { useState } from 'react';
import {
  AlertTriangle, Bookmark, BookOpen, Check, Copy, HelpCircle,
  Lightbulb, ShieldCheck, Sparkles, Target, ThumbsDown, ThumbsUp,
} from 'lucide-react';

function CopyBtn({ text, disabled = false }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    if (disabled) return;
    navigator.clipboard.writeText(text || '').then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    });
  };
  return (
    <button
      type="button"
      className={`oc-copy${done ? ' oc-copy--done' : ''}`}
      onClick={copy}
      disabled={disabled}
    >
      {done ? <Check size={14} /> : <Copy size={15} />}
      {done ? 'Copied' : 'Copy Response'}
    </button>
  );
}

function InsightCard({ variant, icon: Icon, title, children, badge }) {
  return (
    <section className={`oc-insight-card oc-insight-card--${variant}`}>
      <div className="oc-insight-card__head">
        <div className="oc-insight-card__title">
          <Icon size={18} />
          {title}
        </div>
        {badge && <span className="oc-insight-card__badge">{badge}</span>}
      </div>
      <div className="oc-insight-card__body">{children}</div>
    </section>
  );
}

export default function ObjectionCoachResult({ result, repEdited, onRepEditedChange, isPlaceholder = false }) {
  const knowledgeSources = Array.isArray(result.knowledgeSources) ? result.knowledgeSources : [];
  const confidence = typeof result.confidence === 'number' ? Math.round(result.confidence) : 92;
  const whyItems = result.whyThisWorks
    ? result.whyThisWorks.split(/(?<=\.)\s+/).filter(Boolean).slice(0, 4)
    : ['Acknowledges the price concern', 'Positions Green Shield around prevention', 'Focuses on long-term savings'];
  const closingQuestion = result.bestClosingQuestion || 'If I can show you how our service prevents costly problems and saves money over time, does that make sense?';
  const avoidItems = result.thingsToAvoid?.length
    ? result.thingsToAvoid
    : ["Don't just talk about price", "Don't bash competitors", "Don't sound defensive", "Don't over-explain"];

  return (
    <article className={`oc-answer-shell${isPlaceholder ? ' oc-answer-shell--placeholder' : ''}`}>
      <div className="oc-answer-topbar">
        <div className="oc-answer-topbar__title">
          <Sparkles size={27} />
          <span>Recommended Response</span>
          <Sparkles size={19} />
        </div>
        <div className="oc-answer-actions">
          <CopyBtn text={repEdited || result.recommendedResponse} disabled={isPlaceholder} />
          <button type="button" className="oc-answer-icon-btn" aria-label="Bookmark response"><Bookmark size={18} /></button>
          <button type="button" className="oc-answer-icon-btn" aria-label="Helpful response"><ThumbsUp size={18} /></button>
          <button type="button" className="oc-answer-icon-btn" aria-label="Not helpful response"><ThumbsDown size={18} /></button>
        </div>
      </div>

      <div className="oc-main-quote-card">
        <span className="oc-quote-mark oc-quote-mark--left">“</span>
        <textarea
          className="oc-response-edit oc-response-edit--hero"
          rows={5}
          value={repEdited || result.recommendedResponse}
          onChange={e => onRepEditedChange(e.target.value)}
          readOnly={isPlaceholder}
        />
        <span className="oc-quote-mark oc-quote-mark--right">”</span>
        <span className="oc-quote-underline" aria-hidden="true" />
      </div>

      <div className="oc-insight-grid">
        <InsightCard variant="why" icon={Lightbulb} title="Why This Works">
          <ul className="oc-check-list">
            {whyItems.map((item, index) => (
              <li key={index}><Check size={15} /> {item}</li>
            ))}
          </ul>
        </InsightCard>

        <InsightCard variant="closing" icon={Target} title="Best Closing Question">
          <p className="oc-closing-text">"{closingQuestion}"</p>
        </InsightCard>

        <InsightCard variant="avoid" icon={AlertTriangle} title="Things To Avoid">
          <ul className="oc-avoid-list">
            {avoidItems.slice(0, 4).map((item, index) => (
              <li key={index} className="oc-avoid-item"><span className="oc-avoid-item__x">×</span>{item}</li>
            ))}
          </ul>
        </InsightCard>

        <InsightCard
          variant="sources"
          icon={BookOpen}
          title="Knowledge Used"
          badge={knowledgeSources.length ? `${knowledgeSources.length} sources` : 'Ready'}
        >
          {knowledgeSources.length > 0 ? (
            <div className="oc-source-list">
              {knowledgeSources.slice(0, 4).map((source, i) => (
                <div key={`${source.id || source.title || 'source'}-${i}`} className="oc-source-item">
                  <BookOpen size={13} />
                  <div>
                    <div className="oc-source-item__title">{source.title || source.fileName || source.sourceUrl || 'Knowledge source'}</div>
                    <div className="oc-source-item__meta">
                      {source.fileName && <span>{source.fileName}</span>}
                      {source.sourceType && <span>{source.sourceType}</span>}
                      {typeof source.similarity === 'number' && <span>{Math.round(source.similarity * 100)}% match</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="oc-source-list">
              <div className="oc-source-item"><BookOpen size={13} /><div className="oc-source-item__title">Training Center knowledge</div></div>
              <div className="oc-source-item"><BookOpen size={13} /><div className="oc-source-item__title">Approved sales principles</div></div>
              <div className="oc-source-item"><BookOpen size={13} /><div className="oc-source-item__title">Green Shield playbooks</div></div>
            </div>
          )}
        </InsightCard>
      </div>

      <div className="oc-confidence-strip">
        <div className="oc-confidence-strip__item oc-confidence-strip__item--score">
          <ShieldCheck size={38} />
          <div>
            <span>Confidence Score</span>
            <strong>{confidence}%</strong>
          </div>
          <div className="oc-confidence-meter" aria-hidden="true">
            <span style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }} />
          </div>
        </div>
        <div className="oc-confidence-strip__item">
          <Target size={32} />
          <p>High confidence based on company knowledge and similar objections.</p>
        </div>
        <div className="oc-confidence-strip__item">
          <HelpCircle size={32} />
          <p>Powered by <strong>Green Shield Knowledge</strong>.</p>
        </div>
      </div>

      <div className="oc-recent-row">
        <span>Recent Objections</span>
        {['Too expensive', 'Only want one time', 'I need to think', 'Already have someone', 'Not interested'].map((chip, index) => (
          <button key={chip} type="button" className={index === 0 ? 'is-active' : ''}>{chip}</button>
        ))}
      </div>
    </article>
  );
}
