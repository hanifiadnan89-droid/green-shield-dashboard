import { ChevronLeft, GraduationCap, Headphones, Shield, ShieldCheck, Sparkles } from 'lucide-react';

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
            <div className="sc-header__icon"><Shield size={24} /></div>
            <div>
              <div className="sc-header__title">Sales Coach <Sparkles size={16} /></div>
              <div className="sc-header__subtitle">Fast objection handling powered by Green Shield knowledge</div>
            </div>
          </div>
        )}
      </div>

      <div className="sc-header__center">
        {moduleName && <span className="sc-header__module-title">{moduleName}</span>}
      </div>

      <div className="sc-header__right">
        {!moduleName && (
          <div className="sc-brain-status">
            <span><i /> AI Brain Online</span>
            <small>Connected to Green Shield knowledge</small>
          </div>
        )}
        {confidence != null && (
          <span className="sc-confidence-badge">
            <ShieldCheck size={13} />
            {confidence}% Confidence
          </span>
        )}
        {action || (!moduleName && (
          <button type="button" className="sc-training-link">
            <GraduationCap size={16} />
            Training Center
          </button>
        ))}
        {!moduleName && (
          <button type="button" className="sc-header-orb" aria-label="Sales Coach support">
            <Headphones size={19} />
          </button>
        )}
      </div>
    </header>
  );
}
