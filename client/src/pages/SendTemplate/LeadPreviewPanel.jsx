import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, Mail, MessageSquare, Phone, Sparkles, AlertTriangle,
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import {
  formatLeadSent,
  getLeadStatusKey,
  getNotesTemplate,
  getSuggestedNextStep,
  getTemplateReadiness,
  leadInitials,
} from './sendLeadUtils.js';
import { EmptyPreviewState } from './EmptyLeadState.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function LeadPreviewPanel({ lead, onContinue }) {
  return (
    <aside className="send-lead-preview" aria-label="Lead preview">
      <div className="send-lead-preview__header">
        <p className="type-label-sm uppercase tracking-[0.08em] text-gs-muted font-semibold">
          Lead preview
        </p>
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
  const stopBlocked = lead.stop === 'yes';

  return (
    <>
      <motion.div
        className="send-lead-preview__body"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.28, ease: EASE }}
      >
        <div className="flex items-start gap-4">
          <div className="send-lead-card__avatar w-14 h-14 rounded-2xl type-body-sm">
            {leadInitials(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="send-lead-preview__hero-name">{lead.name || 'Unknown'}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <StatusBadge value={statusKey === 'sent' ? 'sent' : statusKey} />
              {notesTemplate && <StatusBadge value={lead.notes} />}
              {lead.stop === 'yes' && <StatusBadge value="stopped" />}
            </div>
          </div>
        </div>

        <section>
          <p className="send-lead-preview__section-title">Contact</p>
          <div className="space-y-2.5 rounded-xl border border-gs-border/60 bg-white/60 p-3.5">
            <p className="send-lead-preview__contact-row">
              <Phone size={15} className="shrink-0 text-gs-accent" />
              <span>{lead.phone || '—'}</span>
            </p>
            <p className="send-lead-preview__contact-row">
              <Mail size={15} className="shrink-0 text-gs-accent" />
              <span className="break-all">{lead.email || '—'}</span>
            </p>
          </div>
        </section>

        <section>
          <p className="send-lead-preview__section-title">Status</p>
          <div className="type-body-sm text-gs-text space-y-1 rounded-xl border border-gs-border/60 bg-white/50 p-3.5">
            {sentLabel ? (
              <p>
                <span className="text-gs-muted">Last sent:</span> {sentLabel}
              </p>
            ) : (
              <p className="text-gs-muted">No template sent yet</p>
            )}
            {lead.reason && (
              <p>
                <span className="text-gs-muted">Reason:</span> {lead.reason}
              </p>
            )}
          </div>
        </section>

        <section>
          <p className="send-lead-preview__section-title">Suggested next step</p>
          <p className="type-body-sm text-gs-text leading-relaxed rounded-xl border border-gs-border/60 bg-white/50 p-3.5">
            {getSuggestedNextStep(lead)}
          </p>
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
                <Sparkles size={16} className="text-gs-accent shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-gs-warn shrink-0" />
              )}
              <span className="type-body-sm font-semibold text-gs-text">{readiness.label}</span>
            </div>
            <p className="type-label-sm text-gs-muted font-normal tracking-normal">{readiness.detail}</p>
            <div className="flex gap-3 mt-3 type-label-sm text-gs-muted">
              <span className="inline-flex items-center gap-1">
                <MessageSquare size={12} />
                SMS {lead.phone ? 'ok' : '—'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Mail size={12} />
                Email {lead.email ? 'ok' : '—'}
              </span>
            </div>
          </div>
        </section>
      </motion.div>

      <div className="send-lead-preview__footer">
        {stopBlocked && (
          <p className="type-label-sm text-gs-danger mb-3 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            This lead is stopped. Clear stop before sending.
          </p>
        )}
        <motion.button
          type="button"
          className="btn-primary w-full flex items-center justify-center gap-2"
          onClick={() => onContinue(lead)}
          disabled={stopBlocked}
          whileHover={stopBlocked ? {} : { y: -1, boxShadow: '0 8px 24px rgba(22,163,74,0.25)' }}
          whileTap={stopBlocked ? {} : { scale: 0.98 }}
        >
          Continue to templates
          <ArrowRight size={16} />
        </motion.button>
        <p className="type-label-sm text-gs-muted text-center mt-2 font-normal tracking-normal">
          Or click the lead card to continue
        </p>
      </div>
    </>
  );
}
