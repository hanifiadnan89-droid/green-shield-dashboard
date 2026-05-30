import { Check } from 'lucide-react';
import { STEPS } from './constants.js';

export default function SendStepIndicator({ step }) {
  return (
    <div className="px-6 py-5 border-b border-gs-border">
      <h1 className="type-heading-lg text-gs-text mb-4">Send Template</h1>
      <div className="flex items-center gap-0">
        {STEPS.map(({ n, label }) => (
          <div key={n} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center type-label-sm font-bold transition-all ${
                  step > n
                    ? 'bg-gs-accent text-black'
                    : step === n
                      ? 'bg-transparent border-2 border-gs-accent text-gs-accent'
                      : 'bg-gs-border text-gs-muted'
                }`}
              >
                {step > n ? <Check size={13} /> : n}
              </div>
              <span
                className={`type-label-sm font-medium tracking-normal ${
                  step === n ? 'text-gs-text' : step > n ? 'text-gs-accent' : 'text-gs-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {n < 3 && (
              <div className={`w-8 h-px mx-2 ${step > n ? 'bg-gs-accent' : 'bg-gs-border'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
