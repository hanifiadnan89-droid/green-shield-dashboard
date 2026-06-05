import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, Mail, MessageSquare, Phone, Sparkles, AlertTriangle, Zap,
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import {
  formatLeadSent,
  getLeadStatusKey,
  getNotesTemplate,
  getSuggestedNextStep,
  getTemplateReadiness,
  getPreferredChannel,
  daysSinceTouch,
  hasReplySignal,
  leadInitials,
} from './sendLeadUtils.js';
import { EmptyPreviewState } from './EmptyLeadState.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function LeadPreviewPanel({ lead, onContinue }) {
  return (
    <aside className="send-lead-preview" aria-label="Lead intelligence">
      <div className="send-lead-preview__header">
        <p className="send-lead-preview__header-title">Lead intelligence</p>
      </div>

      <AnimatePresence mode="wait">
        {!lead ? (
          <motion.div
            key="empty"
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EmptyPreviewState />
          </motion.div>
        ) : (
          <LeadPreviewContent key={lead.row_number} lead={lead} onContinue={onContinue} />
        )}
      </AnimatePresence>
    </aside>
  );
}

function LeadPreviewContent({ lead, onContinue }) {
  const readiness = getTemplateReadiness(lead);
  const notesTemplate = getNotesTemplate(lead);
  const statusKey = getLeadStatusKey(lead);
  const sentLabel = formatLeadSent(lead.sent);
  const days = daysSinceTouch(lead.sent);
  const stopBlocked = lead.stop === 'yes';
  const preferred = getPreferredChannel(lead);
  const replied = hasReplySignal(lead) || lead.status === 'replied';

  return (
    <>
      <motion.div
        className="send-lead-preview__body"
        initial={{ opacity: 0.94, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0.94, x: -8 }}
        transition={{ duration: 0.24, ease: EASE }}
      >
        <section>
          <p className="send-lead-preview__section-title">Lead snapshot</p>
          <div className="flex items-start gap-4">
            <div className="send-lead-card__avatar w-14 h-14 rounded-2xl text-sm">
              {leadInitials(lead.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="send-lead-preview__hero-name">{lead.name || 'Unknown'}</h2>
              {lead.row_number != null && (
                <p className="text-xs text-white/40 mt-0.5">Account #{lead.row_number}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <StatusBadge value={statusKey === 'sent' ? 'sent' : statusKey} />
                {notesTemplate && <StatusBadge value={lead.notes} />}
                {lead.stop === 'yes' && <StatusBadge value="stopped" />}
              </div>
            </div>
          </div>
        </section>

        <section>
          <p className="send-lead-preview__section-title">Communication</p>
          <div className="send-lead-preview__glass space-y-2.5">
            <p className="send-lead-preview__contact-row">
              <Phone size={15} className="shrink-0" />
              <span>{lead.phone || '—'}</span>
            </p>
            <p className="send-lead-preview__contact-row">
              <Mail size={15} className="shrink-0" />
              <span className="break-all">{lead.email || '—'}</span>
            </p>
            <p className="send-lead-preview__contact-row text-white/55 text-xs">
              <Zap size={14} className="shrink-0 text-[#4ade80]" />
              Preferred: {preferred}
            </p>
          </div>
        </section>

        <section>
          <p className="send-lead-preview__section-title">Activity</p>
          <div className="send-lead-preview__metric-grid">
            <div className="send-lead-preview__metric">
              <p className="send-lead-preview__metric-label">Last sent</p>
              <p className="send-lead-preview__metric-value">{sentLabel || 'Never'}</p>
            </div>
            <div className="send-lead-preview__metric">
              <p className="send-lead-preview__metric-label">Days since touch</p>
              <p className="send-lead-preview__metric-value">
                {days != null ? `${days}d` : '—'}
              </p>
            </div>
            <div className="send-lead-preview__metric">
              <p className="send-lead-preview__metric-label">Last reply</p>
              <p className="send-lead-preview__metric-value">{replied ? 'Yes' : 'None'}</p>
            </div>
            <div className="send-lead-preview__metric">
              <p className="send-lead-preview__metric-label">Workflow</p>
              <p className="send-lead-preview__metric-value">
                {notesTemplate?.code?.toUpperCase() || '—'}
              </p>
            </div>
          </div>
        </section>

        <section>
          <p className="send-lead-preview__section-title">Template readiness</p>
          <div
            className={`send-lead-preview__readiness ${
              readiness.ready ? 'send-lead-preview__readiness--ready' : 'send-lead-preview__readiness--blocked'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {readiness.ready ? (
                <Sparkles size={16} className="text-[#4ade80] shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              )}
              <span className="text-sm font-semibold text-white">{readiness.label}</span>
            </div>
            <p className="text-xs text-white/45">{readiness.detail}</p>
            <div className="send-lead-preview__metric-grid mt-3">
              <div className="send-lead-preview__metric">
                <p className="send-lead-preview__metric-label">SMS</p>
                <p className="send-lead-preview__metric-value">{lead.phone ? 'Ready' : '—'}</p>
              </div>
              <div className="send-lead-preview__metric">
                <p className="send-lead-preview__metric-label">Email</p>
                <p className="send-lead-preview__metric-value">{lead.email ? 'Ready' : '—'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="send-lead-preview__ai">
          <p className="send-lead-preview__ai-label">
            <Sparkles size={14} />
            Suggested action
          </p>
          <p className="send-lead-preview__ai-text">{getSuggestedNextStep(lead)}</p>
        </section>
      </motion.div>

      <div className="send-lead-preview__footer">
        {stopBlocked && (
          <p className="text-xs text-red-400 mb-3 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            This lead is stopped. Clear stop before sending.
          </p>
        )}
        <motion.button
          type="button"
          className="send-launch-cta"
          onClick={() => onContinue(lead)}
          disabled={stopBlocked}
          whileHover={stopBlocked ? {} : { y: -2 }}
          whileTap={stopBlocked ? {} : { scale: 0.98 }}
        >
          Launch workflow
          <ArrowRight size={16} />
        </motion.button>
        <p className="text-xs text-white/40 text-center mt-2">
          Or click a lead card to continue
        </p>
      </div>
    </>
  );
}
