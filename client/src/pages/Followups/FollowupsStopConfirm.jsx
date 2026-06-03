import { motion, AnimatePresence } from 'motion/react';
import { StopCircle } from 'lucide-react';

export default function FollowupsStopConfirm({ lead, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {lead && (
        <motion.div
          className="followups-confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="followups-confirm"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-labelledby="followups-stop-title"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gs-danger/10 border border-gs-danger/25 flex items-center justify-center">
                <StopCircle size={20} className="text-gs-danger" />
              </div>
              <h2 id="followups-stop-title" className="text-lg font-bold text-gs-text">
                Stop follow-ups?
              </h2>
            </div>
            <p className="text-sm text-gs-muted leading-relaxed">
              <strong className="text-gs-text">{lead.name}</strong> will no longer receive automated n8n messages.
              You can still message them manually from Replies or Send Template.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <motion.button
                type="button"
                className="followups-btn followups-btn--ghost px-4 py-2"
                onClick={onCancel}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                className="followups-btn followups-btn--stop px-4 py-2"
                onClick={onConfirm}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Stop sequence
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
