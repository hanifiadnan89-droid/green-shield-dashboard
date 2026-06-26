import { Brain, ChevronLeft, ShieldCheck } from 'lucide-react';

export function SalesCoachHeader({ moduleName, onBack, backLabel = 'Sales Coach', confidence, action }) {
  return (
    <header className="sc-header">
      <div className="sc-header__left">
        {moduleName && onBack ? (
          <button className="sc-header__back" onClick={onBack}>
            <ChevronLeft size={15} />
            {backLabel}
          </button>
        ) : (
          <div className="sc-header__brand">
            <div className="sc-header__icon"><Brain size={18} /></div>
            <div>
              <div className="sc-header__title">Sales Coach</div>
              <div className="sc-header__subtitle">Fast objection handling powered by Green Shield knowledge</div>
            </div>
          </div>
        )}
      </div>

      <div className="sc-header__center">
        {moduleName && <span className="sc-header__module-title">{moduleName}</span>}
      </div>

      <div className="sc-header__right">
        {confidence != null && (
          <span className="sc-confidence-badge">
            <ShieldCheck size={13} />
            {confidence}% Confidence
          </span>
        )}
        {action}
      </div>
    </header>
  );
}
