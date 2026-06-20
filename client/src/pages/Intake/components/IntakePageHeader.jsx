import { Cloud, Save } from 'lucide-react';

export default function IntakePageHeader({
  title,
  subtitle,
  continueFormId,
  continueLabel = 'Continue',
  continueDisabled = false,
  onContinueClick,
  continueType = 'submit',
}) {
  return (
    <header className="intake-header">
      <div className="intake-header__copy">
        <h1 className="intake-header__title">{title}</h1>
        {subtitle ? <p className="intake-header__subtitle">{subtitle}</p> : null}
      </div>

      <div className="intake-header__actions">
        <span className="intake-header__autosave">
          <Cloud size={14} />
          Auto-save enabled
        </span>
        <button type="button" className="intake-header__draft-btn">
          <Save size={14} />
          Save Draft
        </button>
        <button
          type={continueType}
          form={continueFormId}
          className="intake-header__continue-btn"
          disabled={continueDisabled}
          onClick={onContinueClick}
        >
          {continueLabel}
        </button>
      </div>
    </header>
  );
}
