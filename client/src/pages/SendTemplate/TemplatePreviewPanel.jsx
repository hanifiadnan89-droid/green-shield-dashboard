import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Mail, MessageSquare, Calendar, Layers, AlertTriangle } from 'lucide-react';
import { enrichTemplate, getTimelineFlowSteps, personalizePreview } from './templateWorkflow.js';
import WorkflowTimeline from './WorkflowTimeline.jsx';

const EASE = [0.22, 1, 0.36, 1];

export function EmptyTemplatePreview() {
  return (
    <motion.div
      className="send-tmpl-preview__empty"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="send-tmpl-preview__empty-icon">
        <Layers size={24} />
      </div>
      <p className="text-sm font-semibold text-gs-text">Select a workflow</p>
      <p className="text-xs text-gs-muted mt-1 max-w-[240px]">
        Click a template card to preview SMS, email, and the full follow-up sequence before continuing.
      </p>
    </motion.div>
  );
}

export default function TemplatePreviewPanel({
  template,
  lead,
  stopBlocked,
  onContinue,
}) {
  return (
    <aside className="send-tmpl-preview" aria-label="Template preview">
      <div className="send-tmpl-preview__header">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gs-muted">
          Workflow preview
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!template ? (
          <motion.div key="empty" className="flex-1 flex flex-col min-h-0">
            <EmptyTemplatePreview />
          </motion.div>
        ) : (
          <TemplatePreviewContent
            key={template.code}
            template={template}
            lead={lead}
            stopBlocked={stopBlocked}
            onContinue={onContinue}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}

function TemplatePreviewContent({ template, lead, stopBlocked, onContinue }) {
  const t = enrichTemplate(template);
  const timelineSteps = getTimelineFlowSteps(t, lead);
  const smsBody = personalizePreview(t.smsPreview, lead);
  const email = t.emailPreview;

  return (
    <>
      <motion.div
        className="send-tmpl-preview__body"
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <div className="send-tmpl-preview__hero">
          <span className={`send-tmpl-preview__code ${t.accentText}`}>{t.code.toUpperCase()}</span>
          <h3 className={`send-tmpl-preview__title ${t.accentText}`}>{t.shortName}</h3>
          <p className="text-xs text-gs-muted mt-1">{t.workflowType}</p>
        </div>

        <div className="send-tmpl-preview__stats">
          <div className="send-tmpl-preview__stat">
            <Layers size={14} className="text-gs-accent" />
            <span>{t.touchCount} messages</span>
          </div>
          <div className="send-tmpl-preview__stat">
            <Calendar size={14} className="text-gs-accent" />
            <span>{t.timelineDays}-day sequence</span>
          </div>
        </div>

        <section>
          <p className="send-tmpl-preview__section-label">
            <MessageSquare size={12} className="inline mr-1.5 -mt-0.5" />
            SMS preview
          </p>
          <div className="send-tmpl-preview__bubble send-tmpl-preview__bubble--sms">
            {smsBody}
          </div>
        </section>

        <section>
          <p className="send-tmpl-preview__section-label">
            <Mail size={12} className="inline mr-1.5 -mt-0.5" />
            Email preview
          </p>
          <div className="send-tmpl-preview__email">
            <p className="send-tmpl-preview__email-subject">
              Subject: {personalizePreview(email?.subject, lead)}
            </p>
            <pre className="send-tmpl-preview__email-body whitespace-pre-wrap font-sans text-xs leading-relaxed">
              {personalizePreview(email?.body, lead)}
            </pre>
          </div>
        </section>

        <section>
          <p className="send-tmpl-preview__section-label">Communication flow</p>
          <WorkflowTimeline steps={timelineSteps} />
        </section>
      </motion.div>

      <div className="send-tmpl-preview__footer">
        {stopBlocked && (
          <p className="text-xs text-gs-danger mb-3 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Lead is stopped — clear stop before sending.
          </p>
        )}
        <motion.button
          type="button"
          className="btn-primary w-full flex items-center justify-center gap-2"
          disabled={stopBlocked}
          onClick={() => onContinue(t)}
          whileHover={stopBlocked ? {} : { y: -1 }}
          whileTap={stopBlocked ? {} : { scale: 0.98 }}
        >
          Continue to Preview &amp; Send
          <ArrowRight size={16} />
        </motion.button>
        <p className="text-xs text-gs-muted text-center mt-2">
          Review documents and channel on the next step
        </p>
      </div>
    </>
  );
}
