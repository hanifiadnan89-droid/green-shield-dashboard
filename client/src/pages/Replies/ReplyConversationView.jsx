import ChatThread from './ChatThread.jsx';
import ReplyComposer from './ReplyComposer.jsx';

/**
 * Active conversation — full thread + compose.
 */
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
    <div className="replies-conversation-panel flex flex-col flex-1 min-h-0">
      {isConfirming && (
        <div className="reply-archive-confirm shrink-0">
          <span className="type-body-sm text-gs-danger font-medium">
            Archive this chat? It won&apos;t appear in your active list.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onArchive(lead)}
              className="type-label-sm font-semibold text-white bg-gs-danger rounded-md px-2.5 py-1 hover:opacity-90 transition-opacity cursor-pointer"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={onCancelArchive}
              className="type-label-sm font-medium text-gs-muted bg-transparent border border-gs-border rounded-md px-2.5 py-1 hover:text-gs-text transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
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
