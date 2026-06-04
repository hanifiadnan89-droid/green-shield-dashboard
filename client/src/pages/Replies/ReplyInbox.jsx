import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import ConversationList from './ConversationList.jsx';

export default function ReplyInbox({
  search,
  onSearchChange,
  showArchived,
  activeLeads,
  archivedLeads,
  selectedRowNumber,
  detailOpen,
  onClearSelection,
  getCard,
  onSelectLead,
  threads,
  meta,
  isUnread,
  pulseRows,
  children,
}) {
  return (
    <div className={`replies-inbox ${detailOpen ? 'replies-inbox--detail-open' : ''}`}>
      <ConversationList
        search={search}
        onSearchChange={onSearchChange}
        showArchived={showArchived}
        activeLeads={activeLeads}
        archivedLeads={archivedLeads}
        selectedRowNumber={selectedRowNumber}
        getCard={getCard}
        onSelectLead={onSelectLead}
        threads={threads}
        meta={meta}
        isUnread={isUnread}
        pulseRows={pulseRows}
      />

      <main className="replies-inbox-detail" aria-label="Conversation">
        {detailOpen && (
          <div className="rc-detail-toolbar lg:hidden">
            <motion.button
              type="button"
              onClick={onClearSelection}
              className="rc-back-btn"
              whileTap={{ scale: 0.97 }}
            >
              <ChevronLeft size={18} aria-hidden />
              Conversations
            </motion.button>
          </div>
        )}
        <div className="replies-inbox-detail-inner">
          {children}
        </div>
      </main>
    </div>
  );
}
