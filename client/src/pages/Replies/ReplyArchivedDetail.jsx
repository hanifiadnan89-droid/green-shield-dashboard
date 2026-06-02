import ChatThread from './ChatThread.jsx';

/** Read-only archived conversation with full thread. */
export default function ReplyArchivedDetail({ lead, thread, syncError, syncing, onRestore }) {
  return (
    <div className="replies-conversation-panel flex flex-col flex-1 min-h-0">
      <ChatThread
        lead={lead}
        thread={thread}
        isArchived
        onRestore={onRestore}
        loading={syncing}
        syncError={syncError}
      />
    </div>
  );
}
