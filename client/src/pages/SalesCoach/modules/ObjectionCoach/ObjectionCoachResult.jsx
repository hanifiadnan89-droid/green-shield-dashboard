import { useState } from 'react';
import { Check, Copy, Database, Lightbulb, MessageSquare, ShieldCheck, Target, Zap, XCircle } from 'lucide-react';

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  const copy = () => {
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
    >
      {done ? <Check size={11} /> : <Copy size={11} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function PanelSection({ icon: Icon, label, accent = 'green', action, children }) {
  return (
    <section className={`oc-panel-section oc-panel-section--${accent}`}>
      <div className="oc-panel-section__head">
        <div className="oc-panel-section__title">
          <span className="oc-panel-section__icon"><Icon size={15} /></span>
          {label}
        </div>
        {action}
      </div>
      <div className="oc-panel-section__body">{children}</div>
    </section>
  );
}

export default function ObjectionCoachResult({ result, repEdited, onRepEditedChange }) {
  const knowledgeSources = Array.isArray(result.knowledgeSources) ? result.knowledgeSources : [];
  const confidence = typeof result.confidence === 'number' ? Math.round(result.confidence) : null;
  const whyThisWorks = result.whyThisWorks || result.salesStrategy || '';

  return (
    <article className="oc-coaching-panel">
      <div className="oc-coaching-panel__topline">
        <div>
          <p className="oc-coaching-panel__eyebrow">Live call answer</p>
          <h2 className="oc-coaching-panel__title">Use this response now</h2>
        </div>
        {confidence != null && (
          <div className="oc-confidence-pill">
            <ShieldCheck size={14} />
            {confidence}% confidence
          </div>
        )}
      </div>

      <PanelSection
        icon={MessageSquare}
        label="Recommended Response"
        accent="green"
        action={<CopyBtn text={repEdited || result.recommendedResponse} />}
      >
        <textarea
          className="oc-response-edit oc-response-edit--primary"
          rows={6}
          value={repEdited}
          onChange={e => onRepEditedChange(e.target.value)}
        />
      </PanelSection>

      <div className="oc-panel-grid">
        {whyThisWorks && (
          <PanelSection
            icon={Lightbulb}
            label="Why This Works"
            accent="blue"
            action={<CopyBtn text={whyThisWorks} />}
          >
            <p>{whyThisWorks}</p>
          </PanelSection>
        )}

        {result.bestClosingQuestion && (
          <PanelSection
            icon={Zap}
            label="Best Closing Question"
            accent="green"
            action={<CopyBtn text={result.bestClosingQuestion} />}
          >
            <p>{result.bestClosingQuestion}</p>
          </PanelSection>
        )}
      </div>

      <div className="oc-panel-grid oc-panel-grid--lower">
        <PanelSection icon={XCircle} label="Things To Avoid" accent="red">
          {result.thingsToAvoid?.length > 0 ? (
            <ul className="oc-avoid-list">
              {result.thingsToAvoid.map((item, i) => (
                <li key={i} className="oc-avoid-item">
                  <span className="oc-avoid-item__x">×</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p>Do not over-explain, discount too early, or argue with the customer.</p>
          )}
        </PanelSection>

        <PanelSection icon={Database} label="Knowledge Used" accent="teal">
          {knowledgeSources.length > 0 ? (
            <div className="oc-source-list">
              {knowledgeSources.map((source, i) => (
                <div key={`${source.id || source.title || 'source'}-${i}`} className="oc-source-item">
                  <div className="oc-source-item__title">{source.title || source.fileName || source.sourceUrl || 'Knowledge source'}</div>
                  <div className="oc-source-item__meta">
                    {source.fileName && <span>{source.fileName}</span>}
                    {source.sourceType && <span>{source.sourceType}</span>}
                    {typeof source.similarity === 'number' && <span>{Math.round(source.similarity * 100)}% match</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>Training Center guidance and approved sales principles were applied. No specific Knowledge Base document matched this objection.</p>
          )}
        </PanelSection>
      </div>

      <PanelSection icon={Target} label="Confidence" accent="gray">
        <div className="oc-confidence-row">
          <div className="oc-confidence-meter" aria-hidden="true">
            <span style={{ width: `${Math.max(0, Math.min(100, confidence ?? 70))}%` }} />
          </div>
          <p>{confidence != null ? `${confidence}% confidence based on available context and company knowledge.` : 'Confidence unavailable for this response.'}</p>
        </div>
      </PanelSection>
    </article>
  );
}
