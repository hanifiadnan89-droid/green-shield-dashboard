import { LayoutGroup, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { STEPS } from './constants.js';

const EASE = [0.22, 1, 0.36, 1];

export default function SendTemplateStepper({ step }) {
  return (
    <header className="send-template-stepper">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <h1 className="send-template-stepper__title type-display-lg text-gs-text font-display tracking-tight">
          Send Template
        </h1>
        <p className="send-template-stepper__subtitle type-body-sm text-gs-muted mt-1 max-w-2xl">
          Launch SMS and email sequences for a lead — pick a contact, choose a workflow, then preview and send.
        </p>
      </motion.div>

      <LayoutGroup>
      <nav className="send-template-stepper__track" aria-label="Send template progress">
        {STEPS.map(({ n, label }, index) => {
          const done = step > n;
          const active = step === n;
          return (
            <div key={n} className="send-template-stepper__step">
              <motion.div
                className="flex items-center gap-2 sm:gap-3"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06, duration: 0.3, ease: EASE }}
              >
                <motion.div
                  className={`send-template-stepper__node ${
                    done
                      ? 'send-template-stepper__node--done'
                      : active
                        ? 'send-template-stepper__node--active'
                        : 'send-template-stepper__node--pending'
                  }`}
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                >
                  {done ? <Check size={14} strokeWidth={2.5} /> : n}
                </motion.div>
                <span
                  className={`send-template-stepper__label ${
                    active ? 'text-gs-text' : done ? 'text-gs-accent-dim' : 'text-gs-muted'
                  }`}
                >
                  {label}
                </span>
              </motion.div>
              {n < 3 && (
                <div
                  className={`send-template-stepper__connector ${step > n ? 'bg-gs-accent' : 'bg-gs-border'}`}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </nav>
      </LayoutGroup>
    </header>
  );
}
