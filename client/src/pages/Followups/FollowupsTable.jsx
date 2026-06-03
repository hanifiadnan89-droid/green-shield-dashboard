import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, StopCircle, MessageSquare, ExternalLink } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import LeadStatusLabel from '../Leads/LeadStatusLabel.jsx';
import FollowupDaysLabel from './FollowupDaysLabel.jsx';
import FollowupStatusLabel from './FollowupStatusLabel.jsx';
import { daysSince } from './followupsUtils.js';

function RowActions({ lead, stopLoading, onStop, onSendAgain, onOpenConversation }) {
  const busy = stopLoading[lead.row_number];
  return (
    <div className="followups-actions" onClick={e => e.stopPropagation()}>
      <motion.button
        type="button"
        className="followups-btn followups-btn--ghost"
        title="Open conversation"
        onClick={() => onOpenConversation(lead)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <MessageSquare size={12} />
      </motion.button>
      <motion.button
        type="button"
        className="followups-btn followups-btn--send"
        onClick={() => onSendAgain(lead)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <Send size={12} />
        Send Again
      </motion.button>
      <motion.button
        type="button"
        className="followups-btn followups-btn--stop"
        onClick={() => onStop(lead)}
        disabled={busy}
        whileHover={{ scale: busy ? 1 : 1.04 }}
        whileTap={{ scale: busy ? 1 : 0.96 }}
      >
        {busy ? <Spinner size={12} /> : <StopCircle size={12} />}
        Stop
      </motion.button>
    </div>
  );
}

export default function FollowupsTable({
  leads,
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

                return (
                  <motion.tr
                    key={lead.row_number}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: Math.min(i * 0.03, 0.35), duration: 0.28 }}
                    className={`followups-row${selected ? ' followups-row--selected' : ''}`}
                    onClick={() => onSelect(lead)}
                    whileHover={{ backgroundColor: 'rgba(22, 163, 74, 0.05)' }}
                  >
                    <td>
                      <button
                        type="button"
                        className="followups-name text-left hover:text-gs-accent cursor-pointer bg-transparent border-0 p-0"
                        onClick={(e) => { e.stopPropagation(); openLead(); }}
                      >
                        {lead.name || '—'}
                        <ExternalLink size={11} className="inline ml-1 opacity-40" />
                      </button>
                    </td>
                    <td>
                      <span className="followups-phone">{lead.phone || '—'}</span>
                    </td>
                    <td>
                      <LeadStatusLabel value={lead.notes} />
                    </td>
                    <td className="text-gs-muted text-xs">{sentLabel}</td>
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
    </div>
  );
}
