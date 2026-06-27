import { ChevronLeft, Shield, ShieldCheck } from 'lucide-react';

export function SalesCoachHeader({
  moduleName, onBack, backLabel = 'Sales Coach',
  confidence, action,
}) {
  const isModule = Boolean(moduleName);

  return (
    <header className="sc-header">
      <div className="sc-header__left">
        {isModule && onBack ? (
          <button type="button" className="sc-header__back" onClick={onBack}>
            <ChevronLeft size={14} aria-hidden="true" />
            {backLabel}
          </button>
        ) : (
          <div className="sc-header__brand">
            <div className="sc-header__icon" aria-hidden="true">
              <Shield size={15} />
            </div>
            <span className="sc-header__title">Sales Coach</span>
          </div>
        )}
      </div>

      <div className="sc-header__center">
        {isModule && <span className="sc-header__module-title">{moduleName}</span>}
      </div>

      <div className="sc-header__right">
        {!isModule && (
          <span className="sc-header__brain" title="Connected to Green Shield knowledge">
            <span className="sc-header__brain-dot" aria-hidden="true" />
            AI Brain Online
          </span>
        )}
        {confidence != null && (
          <span className="sc-confidence-badge">
            <ShieldCheck size={12} aria-hidden="true" />
            {confidence}% Confidence
          </span>
        )}
        {action}
      </div>
    </header>
  );
}
