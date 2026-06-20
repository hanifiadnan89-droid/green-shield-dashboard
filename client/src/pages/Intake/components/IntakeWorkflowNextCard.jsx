import {
  ArrowRight, CalendarCheck, ClipboardCheck, FileText, MapPinned, Sparkles,
} from 'lucide-react';

const STEPS = [
  { title: 'Property Intelligence', icon: MapPinned },
  { title: 'Quote & Proposal', icon: FileText },
  { title: 'Agreement', icon: ClipboardCheck },
  { title: 'Scheduling', icon: CalendarCheck },
  { title: 'Confirmation', icon: Sparkles },
];

export default function IntakeWorkflowNextCard() {
  return (
    <section className="intake-next-card">
      <h3 className="intake-next-card__title">What happens next</h3>
      <div className="intake-next-card__timeline" aria-label="Intake workflow timeline">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === STEPS.length - 1;
          return (
            <div key={step.title} className="intake-next-card__step">
              <div className="intake-next-card__node">
                <span className="intake-next-card__node-icon" aria-hidden>
                  <Icon size={14} />
                </span>
                <span className="intake-next-card__node-label">{step.title}</span>
              </div>
              {!isLast && (
                <span className="intake-next-card__arrow" aria-hidden>
                  <ArrowRight size={14} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
