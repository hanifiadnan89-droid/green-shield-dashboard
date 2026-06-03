import { motion } from 'motion/react';
import { Send, StopCircle, PlayCircle, Edit3 } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';

export default function LeadRowActions({ lead, navigate, onStop, onEdit, actionLoading }) {
  const stopKey = `stop_${lead.row_number}`;
  const isStopped = lead.stop === 'yes';

  return (
    <div className="leads-actions" onClick={e => e.stopPropagation()} role="presentation">
      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/send', { state: { lead } })}
        className="leads-action-btn leads-action-btn--send"
        title="Send template"
        aria-label={`Send template to ${lead.name}`}
      >
        <Send size={15} />
      </motion.button>
      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onStop(lead)}
        disabled={actionLoading[stopKey]}
        className={`leads-action-btn ${isStopped ? 'leads-action-btn--resume' : 'leads-action-btn--stop'}`}
        title={isStopped ? 'Remove stop' : 'Set stop'}
        aria-label={isStopped ? 'Resume follow-ups' : 'Stop follow-ups'}
      >
        {actionLoading[stopKey]
          ? <Spinner size={14} />
          : isStopped ? <PlayCircle size={15} /> : <StopCircle size={15} />}
      </motion.button>
      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onEdit(lead)}
        className="leads-action-btn"
        title="Edit lead"
        aria-label={`Edit ${lead.name}`}
      >
        <Edit3 size={15} />
      </motion.button>
    </div>
  );
}
