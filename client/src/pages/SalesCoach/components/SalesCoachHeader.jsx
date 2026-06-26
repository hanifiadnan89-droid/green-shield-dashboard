import { Brain, ChevronLeft, ShieldCheck } from 'lucide-react';

export function SalesCoachHeader({ moduleName, onBack, confidence }) {
  return (
    <header className="sc-header">
      <div className="sc-header__left">
        {moduleName && onBack ? (
          <button className="sc-header__back" onClick={onBack}>
            <ChevronLeft size={15} />
            All Modules
          </button>
        ) : (
          <div className="sc-header__brand">
            <div className="sc-header__icon"><Brain size={18} /></div>
            <div>
              <div className="sc-header__title">Sales Coach</div>
              <div className="sc-header__subtitle">Green Shield AI Sales Brain</div>
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
      </div>
    </header>
  );
}
