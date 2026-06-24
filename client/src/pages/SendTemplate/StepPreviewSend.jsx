import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, FolderOpen, MessageSquare, Rocket, ChevronRight } from 'lucide-react';
import PreviewDocumentsWorkspace from './PreviewDocumentsWorkspace.jsx';
import PreviewCommunicationCenter from './PreviewCommunicationCenter.jsx';
import PreviewSendSidebar from './PreviewSendSidebar.jsx';

const EASE = [0.22, 1, 0.36, 1];

const STEPS = [
  { n: 1, label: 'Documents', Icon: FolderOpen },
  { n: 2, label: 'Preview',   Icon: MessageSquare },
  { n: 3, label: 'Launch',    Icon: Rocket },
];

function StepSideCard({ step, completed, onClick, summary }) {
  const { n, label, Icon } = step;
  return (
    <motion.button
      type="button"
      onClick={completed ? onClick : undefined}
      disabled={!completed}
      className={`sps-side-card${completed ? ' sps-side-card--done' : ' sps-side-card--future'}`}
      whileHover={completed ? { y: -2, boxShadow: '0 8px 24px rgba(22,163,74,0.12)' } : {}}
      whileTap={completed ? { scale: 0.98 } : {}}
    >
      <div className={`sps-side-card__num${completed ? ' sps-side-card__num--done' : ''}`}>
        {completed ? <Check size={12} strokeWidth={3} /> : <span>{n}</span>}
      </div>
      <div className="sps-side-card__body">
        <p className="sps-side-card__step">Step {n}</p>
        <p className="sps-side-card__label">{label}</p>
        {summary && <p className="sps-side-card__doc">{summary}</p>}
        {completed && (
          <p className="sps-side-card__edit">
            <ChevronRight size={10} />
            Edit
          </p>
        )}
      </div>
      <Icon size={20} className="sps-side-card__icon" />
    </motion.button>
  );
}

export default function StepPreviewSend(props) {
  const [quoteState, setQuoteState] = useState(null);
  const [activeStep, setActiveStep] = useState(1);

  const tmplLabel = props.selectedTemplate?.shortName || props.selectedTemplate?.label || props.selectedTemplate?.name || '';

  return (
    <motion.div
      className="send-preview-launch"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {/* ── Step progress bar ── */}
      <div className="sps-header">
        {STEPS.map((s, i) => (
          <div key={s.n} className="sps-header__item">
            <button
              type="button"
              disabled={s.n > activeStep}
              onClick={() => { if (s.n <= activeStep) setActiveStep(s.n); }}
              className={[
                'sps-header__step',
                activeStep === s.n ? 'sps-header__step--active' : '',
                activeStep > s.n  ? 'sps-header__step--done'   : '',
              ].join(' ').trim()}
            >
              <span className={`sps-header__num${activeStep >= s.n ? ' sps-header__num--on' : ''}`}>
                {activeStep > s.n ? <Check size={10} strokeWidth={3} /> : s.n}
              </span>
              <span className="sps-header__label">Step {s.n}: {s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`sps-header__line${activeStep > s.n ? ' sps-header__line--done' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Stepped workspace ── */}
      {/*
        All three full-content panels are ALWAYS mounted so component-local state
        (selected document, pricing, Bed Bug form) is preserved when the user
        navigates back. CSS display:none hides inactive panels without unmounting.
        Only the lightweight side-card buttons are conditionally rendered.
      */}
      <div className="sps-workspace">

        {/* ── Step 1: Documents ── */}
        <motion.div
          layout
          transition={{ duration: 0.45, ease: EASE }}
          className={activeStep === 1 ? 'sps-slot sps-slot--main' : 'sps-slot sps-slot--side'}
        >
          {/* Full content: always mounted */}
          <div className={activeStep !== 1 ? 'sps-hidden' : 'sps-panel-wrap'}>
            <PreviewDocumentsWorkspace
              selectedLead={props.selectedLead}
              selectedPrepGuides={props.selectedPrepGuides}
              onTogglePrepGuide={props.onTogglePrepGuide}
              onQuoteStateChange={setQuoteState}
            />
            <div className="sps-continue">
              <button
                type="button"
                className="sps-continue-btn"
                onClick={() => setActiveStep(2)}
              >
                Continue to Preview
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          {/* Side card: only when collapsed */}
          {activeStep !== 1 && (
            <StepSideCard
              step={STEPS[0]}
              completed={activeStep > 1}
              onClick={() => setActiveStep(1)}
              summary={quoteState?.selected?.name ?? null}
            />
          )}
        </motion.div>

        {/* ── Step 2: Communication Preview ── */}
        <motion.div
          layout
          transition={{ duration: 0.45, ease: EASE }}
          className={activeStep === 2 ? 'sps-slot sps-slot--main' : 'sps-slot sps-slot--side'}
        >
          <div className={activeStep !== 2 ? 'sps-hidden' : 'sps-panel-wrap'}>
            <PreviewCommunicationCenter
              selectedLead={props.selectedLead}
              selectedTemplate={props.selectedTemplate}
            />
            <div className="sps-continue">
              <button
                type="button"
                className="sps-continue-btn"
                onClick={() => setActiveStep(3)}
              >
                Continue to Launch
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          {activeStep !== 2 && (
            <StepSideCard
              step={STEPS[1]}
              completed={activeStep > 2}
              onClick={() => setActiveStep(2)}
              summary={tmplLabel || null}
            />
          )}
        </motion.div>

        {/* ── Step 3: Launch ── */}
        <motion.div
          layout
          transition={{ duration: 0.45, ease: EASE }}
          className={activeStep === 3 ? 'sps-slot sps-slot--main' : 'sps-slot sps-slot--side'}
        >
          <div className={activeStep !== 3 ? 'sps-hidden' : 'sps-launch-center'}>
            <PreviewSendSidebar
              {...props}
              quoteState={quoteState}
            />
          </div>
          {activeStep !== 3 && (
            <StepSideCard
              step={STEPS[2]}
              completed={false}
              onClick={() => {}}
              summary={null}
            />
          )}
        </motion.div>

      </div>
    </motion.div>
  );
}
