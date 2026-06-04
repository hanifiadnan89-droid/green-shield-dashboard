import { motion } from 'motion/react';
import ChatThread from './ChatThread.jsx';
import ReplyComposer from './ReplyComposer.jsx';

export default function ReplyConversationView({
  lead,
  cardState: cs,
  thread,
  syncError,
  syncing,
  isConfirming,
  textareaRef,
  onToggleArchiveConfirm,
  onArchive,
  onCancelArchive,
  onUpdateCard,
  onSend,
  onKeyDown,
  onAiPromptChange,
  onAiAssist,
}) {
  return (
    <div className="replies-conversation-panel">
      {isConfirming && (
        <motion.div
          className="rc-archive-confirm"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <span>Archive this chat? It won&apos;t appear in your active list.</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onArchive(lead)}
              className="rc-send-btn text-xs py-1.5 px-3"
              style={{ background: 'linear-gradient(135deg, #f87171, #ef4444)', color: '#fff', border: 'none' }}
            >
              Archive
            </button>
            <button type="button" onClick={onCancelArchive} className="rc-btn-ghost">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      <ChatThread
        lead={lead}
        thread={thread}
        isConfirming={isConfirming}
        isArchived={false}
        onToggleArchiveConfirm={onToggleArchiveConfirm}
        loading={syncing}
        syncError={syncError}
      />

      <ReplyComposer
        lead={lead}
        cardState={cs}
        textareaRef={textareaRef}
        onUpdateCard={onUpdateCard}
        onSend={onSend}
        onKeyDown={onKeyDown}
        onAiPromptChange={onAiPromptChange}
        onAiAssist={onAiAssist}
      />
    </div>
  );
}
