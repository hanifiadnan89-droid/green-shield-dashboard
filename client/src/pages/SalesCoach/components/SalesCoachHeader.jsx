import { Brain } from 'lucide-react';

/**
 * Shared page header used by SalesCoachPage in both home and module views.
 *
 * When moduleName is provided, renders the breadcrumb/back button.
 */
export function SalesCoachHeader({ moduleName, onBack }) {
  return (
    <header className="sc-header">
      <div className="sc-header__identity">
        <div className="sc-header__icon">
          <Brain size={18} />
        </div>
        <div>
          <div className="sc-header__title">Sales Coach</div>
          <div className="sc-header__subtitle">Green Shield AI Sales Brain</div>
        </div>
      </div>

      {moduleName && onBack && (
        <div className="sc-header__module-name">
          <button className="sc-header__back" onClick={onBack}>
            &#8592; All Modules
          </button>
          <h1>{moduleName}</h1>
        </div>
      )}
    </header>
  );
}
