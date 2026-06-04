import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, StopCircle, MessageSquare, ExternalLink, Mail, Phone,
} from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import { hasRealReply } from '../CRMPreview/mockData.js';
import { leadInitials } from '../Leads/leadInitials.js';
import { parseLeadName } from '../Leads/parseLeadName.js';
import LeadsPagination from '../Leads/LeadsPagination.jsx';
import FollowupDaysLabel from './FollowupDaysLabel.jsx';
import FollowupStatusLabel from './FollowupStatusLabel.jsx';
import { daysSince, templateCode } from './followupsUtils.js';

function FollowupNameCell({ lead, onOpenLead }) {
  const { displayName } = parseLeadName(lead.name);
  const name = displayName || lead.name || '—';
  const hasReply = hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply);

  return (
    <div className="fc-name-cell">
      <span className="fc-avatar" aria-hidden>{leadInitials(name)}</span>
      <div className="min-w-0">
        <button
          type="button"
          className="fc-name-link"
          onClick={(e) => { e.stopPropagation(); onOpenLead(lead); }}
        >
          {name}
          <ExternalLink size={11} className="opacity-50" aria-hidden />
        </button>
        <div className="fc-name-meta">
          {lead.phone && (
            <span className="fc-name-meta__tag">
              <Phone size={9} aria-hidden /> SMS
            </span>
          )}
          {lead.email && (
            <span className="fc-name-meta__tag">
              <Mail size={9} aria-hidden /> Email
            </span>
          )}
          {hasReply && (
            <span className="fc-name-meta__tag fc-name-meta__tag--reply">
              <MessageSquare size={9} aria-hidden /> Reply
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RowActions({ lead, stopLoading, onStop, onSendAgain, onOpenConversation }) {
  const busy = stopLoading[lead.row_number];
  return (
    <div className="followups-actions" onClick={e => e.stopPropagation()}>
      <motion.button
        type="button"
        className="followups-btn followups-btn--ghost"
        title="Open conversation"
        onClick={() => onOpenConversation(lead)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageSquare size={14} />
      </motion.button>
      <motion.button
        type="button"
        className="followups-btn followups-btn--send"
        onClick={() => onSendAgain(lead)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <Send size={12} />
        Send Again
      </motion.button>
      <motion.button
        type="button"
        className="followups-btn followups-btn--stop"
        onClick={() => onStop(lead)}
        disabled={busy}
        whileHover={{ scale: busy ? 1 : 1.03 }}
        whileTap={{ scale: busy ? 1 : 0.97 }}
      >
        {busy ? <Spinner size={12} /> : <StopCircle size={12} />}
        Stop
      </motion.button>
    </div>
  );
}

export default function FollowupsTable({
  leads,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedLead,
  onSelect,
  stopLoading,
  onStop,
  onSendAgain,
}) {
  const navigate = useNavigate();

  const openConversation = (lead) => {
    navigate('/replies', { state: { lead } });
  };

  const openLead = () => {
    navigate('/leads');
  };

  return (
    <div className="followups-table-shell">
      <div className="followups-table-wrap">
        <table className="followups-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Template</th>
              <th>Sent</th>
              <th>Days Since</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {leads.map((lead, i) => {
                const days = daysSince(lead.sent);
                const selected = selectedLead?.row_number === lead.row_number;
                const sentLabel = lead.sent && lead.sent !== 'imported'
                  ? new Date(lead.sent).toLocaleDateString()
                  : '—';
                const code = templateCode(lead);

                return (
                  <motion.tr
                    key={lead.row_number}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: Math.min(i * 0.025, 0.3), duration: 0.26 }}
                    className={`followups-row${selected ? ' followups-row--selected' : ''}`}
                    onClick={() => onSelect(lead)}
                  >
                    <td>
                      <FollowupNameCell lead={lead} onOpenLead={openLead} />
                    </td>
                    <td>
                      <span className="followups-phone">{lead.phone || '—'}</span>
                    </td>
                    <td>
                      {code ? (
                        <span
                          className="fc-template-link"
                          onClick={e => e.stopPropagation()}
                          role="presentation"
                        >
                          {code}
                        </span>
                      ) : (
                        <span className="lc-field lc-field--empty">—</span>
                      )}
                    </td>
                    <td>
                      <span className="fc-sent">{sentLabel}</span>
                    </td>
                    <td>
                      <FollowupDaysLabel days={days} />
                    </td>
                    <td>
                      <FollowupStatusLabel lead={lead} days={days} />
                    </td>
                    <td>
                      <RowActions
                        lead={lead}
                        stopLoading={stopLoading}
                        onStop={onStop}
                        onSendAgain={onSendAgain}
                        onOpenConversation={openConversation}
                      />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <LeadsPagination
        page={page}
        pageSize={pageSize}
        total={totalCount}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
