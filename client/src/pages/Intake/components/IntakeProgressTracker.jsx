const STEPS = [
  'Customer Intake',
  'Property Intelligence',
  'Quote & Proposal',
  'Agreement',
  'Confirmation',
];

export default function IntakeProgressTracker({ currentStep = 1 }) {
  return (
    <ol className="intake-progress" aria-label="Intake workflow progress">
      {STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const done = currentStep > stepNumber;
        const active = currentStep === stepNumber;
        return (
          <li
            key={label}
            className={[
              'intake-progress__step',
              done ? 'is-done' : '',
              active ? 'is-active' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="intake-progress__marker">{done ? '✓' : stepNumber}</span>
            <span className="intake-progress__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
