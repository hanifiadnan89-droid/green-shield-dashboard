import { useState } from 'react';
import { MessageSquare, Lightbulb, Target, Heart, Zap, XCircle, Copy, Check } from 'lucide-react';

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
      className={`oc-copy${done ? ' oc-copy--done' : ''}`}
      onClick={copy}
    >
      {done ? <Check size={11} /> : <Copy size={11} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function CoachCard({ variant, icon: Icon, iconColor, label, action, children }) {
  return (
    <div className={`oc-card oc-card--${variant}`}>
      <div className="oc-card__head">
        <div className="oc-card__head-left">
          <div className="oc-card__icon">
            <Icon size={15} color={iconColor} />
          </div>
          <span className="oc-card__label">{label}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function ObjectionCoachResult({ result, repEdited, onRepEditedChange }) {
  const hasBothBottom = result.bestClosingQuestion && result.thingsToAvoid?.length > 0;

  return (
    <>
      {/* 1. Recommended Response (editable) */}
      <CoachCard
        variant="response"
        icon={MessageSquare}
        iconColor="#16a34a"
        label="Recommended Response"
        action={<CopyBtn text={repEdited || result.recommendedResponse} />}
      >
        <textarea
          className="oc-response-edit"
          rows={5}
          value={repEdited}
          onChange={e => onRepEditedChange(e.target.value)}
        />
      </CoachCard>

      {/* 2. Why This Works */}
      {result.whyThisWorks && (
        <CoachCard variant="why" icon={Lightbulb} iconColor="#2563eb" label="Why This Works">
          <p className="oc-card__body">{result.whyThisWorks}</p>
        </CoachCard>
      )}

      {/* 3. Sales Strategy */}
      {result.salesStrategy && (
        <CoachCard variant="strategy" icon={Target} iconColor="#ea580c" label="Sales Strategy">
          <p className="oc-card__body">{result.salesStrategy}</p>
        </CoachCard>
      )}

      {/* 4. Softer Version */}
      {result.softerVersion && (
        <CoachCard
          variant="softer"
          icon={Heart}
          iconColor="#7c3aed"
          label="Alternative — Softer Version"
          action={<CopyBtn text={result.softerVersion} />}
        >
          <p className="oc-card__body">{result.softerVersion}</p>
        </CoachCard>
      )}

      {/* 5+6: Best Closing Question + Things To Avoid in 2-col grid */}
      {(result.bestClosingQuestion || result.thingsToAvoid?.length > 0) && (
        <div className={hasBothBottom ? 'oc-cards-grid' : undefined}>
          {result.bestClosingQuestion && (
            <CoachCard
              variant="closing"
              icon={Zap}
              iconColor="#16a34a"
              label="Best Closing Question"
              action={<CopyBtn text={result.bestClosingQuestion} />}
            >
              <p className="oc-card__body">{result.bestClosingQuestion}</p>
            </CoachCard>
          )}

          {result.thingsToAvoid?.length > 0 && (
            <CoachCard variant="avoid" icon={XCircle} iconColor="#dc2626" label="Things To Avoid">
              <ul className="oc-avoid-list">
                {result.thingsToAvoid.map((item, i) => (
                  <li key={i} className="oc-avoid-item">
                    <span className="oc-avoid-item__x">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CoachCard>
          )}
        </div>
      )}
    </>
  );
}
