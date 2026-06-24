import { LayoutGroup, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { STEPS } from './constants.js';

const EASE = [0.22, 1, 0.36, 1];

const BEAM_WIDTH = { 1: '12%', 2: '50%', 3: '100%' };

export default function SendTemplateStepper({ step }) {
  return (
    <header className="send-template-stepper">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <h1 className="send-template-stepper__title type-display-lg font-display tracking-tight">
          Send Template
        </h1>
      </motion.div>

      <LayoutGroup>
        <nav className="send-template-stepper__track" aria-label="Send template progress">
          <div className="send-template-stepper__beam" aria-hidden>
            <motion.div
              className="send-template-stepper__beam-fill"
              animate={{ width: BEAM_WIDTH[step] || '12%' }}
              transition={{ duration: 0.45, ease: EASE }}
            />
          </div>

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
                      active
                        ? 'send-template-stepper__label--active'
                        : done
                          ? 'send-template-stepper__label--done'
                          : ''
                    }`}
                  >
                    {label}
                  </span>
                </motion.div>
                {n < 3 && (
                  <div
                    className={`send-template-stepper__connector ${
                      step > n ? 'send-template-stepper__connector--done' : ''
                    }`}
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
