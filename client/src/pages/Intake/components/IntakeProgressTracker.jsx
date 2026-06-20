import { Check } from 'lucide-react';

const STEPS = [
  'Customer Intake',
  'Property Intelligence',
  'Quote & Proposal',
  'Agreement',
  'Confirmation',
];

export default function IntakeProgressTracker({ currentStep = 1 }) {
  return (
    <div className="intake-progress-wrap" aria-label="Intake workflow progress">
      <ol className="intake-progress">
        {STEPS.map((label, index) => {
          const stepNumber = index + 1;
          const done = currentStep > stepNumber;
          const active = currentStep === stepNumber;
          const upcoming = currentStep < stepNumber;

          return (
            <li
              key={label}
              className={[
                'intake-progress__step',
                done ? 'is-done' : '',
                active ? 'is-active' : '',
                upcoming ? 'is-upcoming' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="intake-progress__marker" aria-hidden>
                {done ? <Check size={14} strokeWidth={3} /> : stepNumber}
              </span>
              <span className="intake-progress__label">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
