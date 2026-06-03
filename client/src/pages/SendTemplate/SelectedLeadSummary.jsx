import { motion } from 'motion/react';
import { Mail, Phone, User, ArrowLeftRight, Sparkles, AlertTriangle } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import {
  formatLeadSent,
  getLeadStatusKey,
  getTemplateReadiness,
  leadInitials,
} from './sendLeadUtils.js';

const EASE = [0.22, 1, 0.36, 1];

export default function SelectedLeadSummary({ lead, preselected, onChangeLead }) {
  if (!lead) return null;

  const readiness = getTemplateReadiness(lead);
  const statusKey = getLeadStatusKey(lead);
  const sentLabel = formatLeadSent(lead.sent);
  const notesCode = (lead.notes || '').trim().toUpperCase() || null;

  return (
    <motion.section
      className="send-lead-summary"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="send-lead-summary__glow" aria-hidden />

      <div className="send-lead-summary__inner">
        <div className="send-lead-summary__top">
          <div className="send-lead-summary__avatar">{leadInitials(lead.name)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gs-muted">
              Sending to
            </p>
            <h2 className="send-lead-summary__name">{lead.name || 'Unknown'}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <StatusBadge value={statusKey === 'sent' ? 'sent' : statusKey} />
              {notesCode && <StatusBadge value={lead.notes} />}
              {lead.stop === 'yes' && <StatusBadge value="stopped" />}
            </div>
          </div>
          {!preselected && (
            <motion.button
              type="button"
              className="btn-ghost text-xs shrink-0"
              onClick={onChangeLead}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Change lead
            </motion.button>
          )}
        </div>

        <div className="send-lead-summary__grid">
          <div className="send-lead-summary__cell">
            <Phone size={14} className="text-gs-accent shrink-0" />
            <div>
              <p className="send-lead-summary__label">Phone</p>
              <p className="send-lead-summary__value">{lead.phone || '—'}</p>
            </div>
          </div>
          <div className="send-lead-summary__cell">
            <Mail size={14} className="text-gs-accent shrink-0" />
            <div className="min-w-0">
              <p className="send-lead-summary__label">Email</p>
              <p className="send-lead-summary__value break-all">{lead.email || '—'}</p>
            </div>
          </div>
          <div className="send-lead-summary__cell">
            <User size={14} className="text-gs-accent shrink-0" />
            <div>
              <p className="send-lead-summary__label">Source / reason</p>
              <p className="send-lead-summary__value">{lead.reason || '—'}</p>
            </div>
          </div>
          <div className="send-lead-summary__cell">
            <ArrowLeftRight size={14} className="text-gs-accent shrink-0" />
            <div>
              <p className="send-lead-summary__label">Last sent</p>
              <p className="send-lead-summary__value">{sentLabel || 'Not yet sent'}</p>
            </div>
          </div>
        </div>

        <div
          className={`send-lead-summary__readiness ${
            readiness.ready ? 'send-lead-summary__readiness--ok' : 'send-lead-summary__readiness--warn'
          }`}
        >
          {readiness.ready ? (
            <Sparkles size={16} className="text-gs-accent shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-gs-warn shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-gs-text">{readiness.label}</p>
            <p className="text-xs text-gs-muted mt-0.5">{readiness.detail}</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
