import { motion } from 'motion/react';
import { Mail, Smartphone } from 'lucide-react';
import { enrichTemplate, getTimelineFlowSteps, personalizePreview } from './templateWorkflow.js';
import WorkflowTimeline from './WorkflowTimeline.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function PreviewCommunicationCenter({ selectedLead, selectedTemplate }) {
  const tmpl = enrichTemplate(selectedTemplate);
  const sms = personalizePreview(tmpl.smsPreview, selectedLead);
  const email = tmpl.emailPreview;
  const steps = getTimelineFlowSteps(tmpl, selectedLead);
  const attachmentCount = 0;

  return (
    <motion.section
      className="send-preview-comm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
    >
      <header className="send-preview-comm__header">
        <h3 className="text-sm font-semibold text-gs-text">Communication preview</h3>
        <p className="text-xs text-gs-muted mt-0.5">Representative content — final copy from n8n workflow</p>
      </header>

      <div className="send-preview-comm__grid">
        <div className="send-preview-phone">
          <div className="send-preview-phone__bezel">
            <div className="send-preview-phone__notch" />
            <div className="send-preview-phone__screen">
              <p className="send-preview-phone__label">
                <Smartphone size={11} className="inline mr-1" />
                SMS to {selectedLead?.phone || 'customer'}
              </p>
              <motion.div
                className="send-preview-phone__bubble"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3, ease: EASE }}
              >
                {sms}
              </motion.div>
              <p className="send-preview-phone__time">Delivered · Day 0</p>
            </div>
          </div>
        </div>

        <div className="send-preview-email">
          <p className="send-preview-email__label">
            <Mail size={12} className="inline mr-1" />
            Email
          </p>
          <motion.div
            className="send-preview-email__card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3, ease: EASE }}
          >
            <div className="send-preview-email__row">
              <span className="text-gs-muted">To</span>
              <span className="text-gs-text truncate">{selectedLead?.email || '—'}</span>
            </div>
            <div className="send-preview-email__row send-preview-email__subject">
              <span className="text-gs-muted">Subject</span>
              <span className="font-semibold text-gs-text">
                {personalizePreview(email?.subject, selectedLead)}
              </span>
            </div>
            <pre className="send-preview-email__body whitespace-pre-wrap font-sans">
              {personalizePreview(email?.body, selectedLead)}
            </pre>
            {attachmentCount > 0 && (
              <p className="send-preview-email__attach text-xs text-gs-muted mt-2">
                {attachmentCount} attachment(s) from quote workflow
              </p>
            )}
          </motion.div>
        </div>
      </div>

      <div className="send-preview-comm__timeline">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gs-muted mb-3">
          Follow-up sequence
        </p>
        <WorkflowTimeline steps={steps} />
      </div>
    </motion.section>
  );
}
