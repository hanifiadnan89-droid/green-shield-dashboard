import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { confidenceLevel } from '../../utils/salesCoachFormatters.js';

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

function ResultSection({ variant, label, children }) {
  return (
    <div className={`oc-result-section oc-result-section--${variant}`}>
      <div className="oc-result-label">{label}</div>
      {children}
    </div>
  );
}

/**
 * Displays the 7-section AI coaching result.
 *
 * Props:
 *   result       — full coaching object from the API
 *   repEdited    — editable copy of recommendedResponse
 *   onRepEditedChange — setter for repEdited
 */
export default function ObjectionCoachResult({ result, repEdited, onRepEditedChange }) {
  const level = confidenceLevel(result.confidence ?? 70);

  return (
    <div className="oc-results">
      {/* Confidence badge row */}
      <div className="oc-result-header">
        <span className="text-xs font-semibold text-gs-muted">Coaching Result</span>
        {result.confidence != null && (
          <span className={`oc-confidence-badge oc-confidence-badge--${level}`}>
            {level === 'high' ? '✓' : level === 'medium' ? '~' : '?'}
            {' '}{result.confidence}% Confidence
          </span>
        )}
      </div>

      {/* 1. Recommended Response (editable) */}
      <ResultSection variant="response" label="Recommended Response">
        <div className="oc-result-header">
          <span />
          <CopyBtn text={repEdited || result.recommendedResponse} />
        </div>
        <textarea
          className="oc-result-response"
          rows={5}
          value={repEdited}
          onChange={e => onRepEditedChange(e.target.value)}
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
    </div>
  );
}
