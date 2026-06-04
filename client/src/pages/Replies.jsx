import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, CheckCircle2, AlertCircle, Archive } from 'lucide-react';
import { api } from '../api/client.js';
import EmptyState from '../components/EmptyState.jsx';
import ReplyPageHeader from './Replies/ReplyPageHeader.jsx';
import ReplyInbox from './Replies/ReplyInbox.jsx';
import ReplyConversationView from './Replies/ReplyConversationView.jsx';
import ReplyArchivedDetail from './Replies/ReplyArchivedDetail.jsx';
import RepliesAmbientBackground from './Replies/RepliesAmbientBackground.jsx';
import RepliesLoadingSkeleton from './Replies/RepliesLoadingSkeleton.jsx';
import './Replies/replies-command.css';
import { useReplyArchive } from './Replies/useReplyArchive.js';
import { useReplyCardState } from './Replies/useReplyCardState.js';
import { useReplySelection } from './Replies/useReplySelection.js';
import { useConversationThreads } from './Replies/useConversationThreads.js';
import { useUnreadReplies } from './Replies/useUnreadReplies.js';
import {
  buildThread,
  archKey,
  getConversationSortTime,
  partitionSearchedReplyLeads,
} from './Replies/threadUtils.js';
import { buildLeadContext } from './Replies/buildLeadContext.js';

import { hasConversationSignal } from './Replies/conversationLeadFilter.js';

export default function Replies() {
  const location = useLocation();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const textareaRef = useRef(null);
  const prevThreadsRef = useRef({});

  const {
    threads,
    meta,
    syncError,
    syncing,
    syncLeads,
    appendOptimistic,
    getMessages,
    patchMeta,
  } = useConversationThreads();

  const {
    isUnread,
    markRead,
    notifyNewInbound,
    pulseRows,
    applyMetaReadState,
  } = useUnreadReplies();

  const {
    archived,
    showArchived,
    setShowArchived,
    archiveConfirm,
    setArchiveConfirm,
    archiveLead: archiveLeadBase,
    restoreLead: restoreLeadBase,
    archivedCount,
  } = useReplyArchive();
  const { getCard, updateCard } = useReplyCardState();

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const ta = getConversationSortTime(a, threads[a.row_number], meta[a.row_number]);
      const tb = getConversationSortTime(b, threads[b.row_number], meta[b.row_number]);
      return tb - ta;
    });
  }, [leads, threads, meta]);

  const searchTrimmed = search.trim();

  const { activeLeads, archivedLeads, hasActiveSearch } = useMemo(
    () => partitionSearchedReplyLeads(sortedLeads, {
      search: searchTrimmed,
      threads,
      archived,
      showArchived,
    }),
    [sortedLeads, searchTrimmed, threads, archived, showArchived],
  );

  const {
    selectedRowNumber,
    selectLead: selectLeadBase,
    clearSelection,
    selectAfterArchive,
    isArchivedLead,
    detailOpen,
  } = useReplySelection({
    activeLeads,
    archivedLeads,
    showArchived,
    loading,
    searchQuery: searchTrimmed,
  });

  const selectedLead = leads.find(l => l.row_number === selectedRowNumber) ?? null;
  const selectedIsArchived = selectedLead ? isArchivedLead(selectedLead, archived) : false;
  const selectedMessages = selectedLead ? getMessages(selectedLead.row_number) : [];
  const selectedThread = selectedLead
    ? buildThread(selectedLead, {}, selectedMessages).map(m => m)
    : [];

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { leads: all } = await api.leads.list();
      const replyLeads = (all || []).filter(hasConversationSignal);
      const synced = await syncLeads(replyLeads);

      for (const lead of replyLeads) {
        const prev = prevThreadsRef.current[lead.row_number];
        notifyNewInbound(lead, synced[lead.row_number] || [], prev);
      }
      prevThreadsRef.current = synced;

      setLeads(replyLeads);
    } catch (err) {
      console.error('[Replies] loadLeads failed:', err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [syncLeads, notifyNewInbound]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    applyMetaReadState(meta);
  }, [meta, applyMetaReadState]);

  useEffect(() => {
    if (loading) return;
    const count = leads.filter(l =>
      isUnread(l, threads[l.row_number] || [], meta[l.row_number]),
    ).length;
    window.dispatchEvent(new CustomEvent('replies-unread-count', { detail: { count } }));
  }, [loading, leads, threads, meta, isUnread]);

  const markReadWithMeta = useCallback(async (lead, messages) => {
    const result = await markRead(lead, messages);
    if (result?.lastReadInboundKey != null || result?.lastReadAt != null) {
      patchMeta(lead.row_number, {
        lastReadInboundKey: result.lastReadInboundKey,
        lastReadAt: result.lastReadAt,
        lastInboundAt: result.lastInboundAt,
        unread: false,
      });
    }
  }, [markRead, patchMeta]);

  useEffect(() => {
    if (!loading && selectedLead && !selectedIsArchived) {
      void markReadWithMeta(selectedLead, selectedMessages);
      const t = setTimeout(() => textareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
    if (selectedLead) {
      void markReadWithMeta(selectedLead, selectedMessages);
    }
  }, [loading, selectedRowNumber, selectedIsArchived, selectedLead, selectedMessages, markReadWithMeta]);

  const selectLead = useCallback((rowNumber) => {
    selectLeadBase(rowNumber);
    const lead = leads.find(l => l.row_number === rowNumber);
    if (lead) void markReadWithMeta(lead, getMessages(rowNumber));
  }, [selectLeadBase, leads, getMessages, markReadWithMeta]);

  const deepLinkRowRef = useRef(location.state?.selectRowNumber);

  useEffect(() => {
    const row = deepLinkRowRef.current;
    if (row == null || loading || !leads.length) return;
    const lead = leads.find(l => l.row_number === row);
    if (!lead) return;
    if (archived.has(archKey(lead))) setShowArchived(true);
    selectLead(row);
    deepLinkRowRef.current = null;
  }, [loading, leads, archived, selectLead, setShowArchived]);

  function archiveLead(lead) {
    const rowNumber = lead.row_number;
    archiveLeadBase(lead);
    selectAfterArchive(rowNumber);
  }

  function restoreLead(lead) {
    restoreLeadBase(lead);
    selectLead(lead.row_number);
  }

  async function handleSend(lead) {
    const cs = getCard(lead.row_number);
    const msg = (cs.message || '').trim();
    if (!msg || cs.sending) return;

    updateCard(lead.row_number, { sending: true, error: null });
    try {
      const result = await api.sms.send(lead.phone, msg, lead.row_number, lead.name);
      const persisted = result.persistedMessage || {
        id: `local-${Date.now()}`,
        direction: 'outbound',
        channel: 'sms',
        body: msg,
        ts: new Date().toISOString(),
        sender: 'You',
        status: 'sent',
      };
      appendOptimistic(lead.row_number, persisted);
      updateCard(lead.row_number, {
        message: '', sending: false, sent: true, error: null, sentAt: new Date(),
      });
      showToast(`SMS sent to ${lead.name}`);
      await syncLeads([lead]);
    } catch (err) {
      updateCard(lead.row_number, { sending: false, error: err.message });
    }
  }

  function handleKeyDown(e, lead) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(lead);
    }
  }

  function handleAiPromptChange(rowNumber, value) {
    updateCard(rowNumber, { aiPrompt: value, aiError: null });
  }

  async function handleAIAssist(lead, promptOverride) {
    const prompt = (promptOverride ?? getCard(lead.row_number).aiPrompt ?? '').trim();
    if (!prompt) return;

    if (promptOverride != null) {
      updateCard(lead.row_number, { aiPrompt: promptOverride, aiError: null });
    }

    const messages = getMessages(lead.row_number);
    const leadContext = buildLeadContext(lead, messages, { archived });
    const currentDraft = (getCard(lead.row_number).message || '').trim();

    updateCard(lead.row_number, {
      aiGenerating: true,
      aiError: null,
      reviewRequired: false,
      reviewReason: null,
    });

    try {
      const result = await api.ai.assistReply(leadContext, prompt, currentDraft);
      updateCard(lead.row_number, {
        aiGenerating: false,
        message: result.draft || '',
        sent: false,
        error: null,
        reviewRequired: result.human_review_required || false,
        reviewReason: result.review_reason || null,
      });
      document.getElementById(`reply-ta-${lead.row_number}`)?.focus();
    } catch (err) {
      updateCard(lead.row_number, { aiGenerating: false, aiError: err.message });
    }
  }

  const showInbox = !loading && leads.length > 0;
  const allArchivedHidden =
    !hasActiveSearch && activeLeads.length === 0 && archivedCount > 0 && !showArchived;

  return (
    <div className="replies-command flex-1 flex flex-col min-h-0 overflow-hidden">
      <RepliesAmbientBackground />
      <div className="replies-command__inner">
      <ReplyPageHeader
        loading={loading}
        archivedCount={archivedCount}
        showArchived={showArchived}
        onToggleArchived={() => {
          setShowArchived(v => {
            const next = !v;
            if (v && !next && selectedLead && selectedIsArchived && typeof window !== 'undefined'
              && !window.matchMedia('(min-width: 1024px)').matches) {
              clearSelection();
            }
            return next;
          });
        }}
        onRefresh={loadLeads}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`replies-toast ${
              toast.type === 'error' ? 'replies-toast--error' : 'replies-toast--success'
            }`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {toast.type === 'error'
              ? <AlertCircle size={14} className="shrink-0" />
              : <CheckCircle2 size={14} className="shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 flex flex-col">
        {loading ? (
          <RepliesLoadingSkeleton />
        ) : leads.length === 0 ? (
          <div className="rc-page-empty">
            <EmptyState
              icon={MessageCircle}
              title="No replies yet"
              desc="When customers reply via SMS or email, conversations will appear here"
            />
          </div>
        ) : allArchivedHidden ? (
          <div className="rc-page-empty">
            <EmptyState
              icon={Archive}
              title="All chats archived"
              desc="Toggle archived in the header to view them"
            />
          </div>
        ) : showInbox ? (
          <ReplyInbox
            search={search}
            onSearchChange={setSearch}
            showArchived={showArchived}
            activeLeads={activeLeads}
            archivedLeads={archivedLeads}
            selectedRowNumber={selectedRowNumber}
            detailOpen={detailOpen}
            onClearSelection={clearSelection}
            getCard={getCard}
            onSelectLead={selectLead}
            threads={threads}
            meta={meta}
            isUnread={isUnread}
            pulseRows={pulseRows}
          >
            <AnimatePresence mode="wait">
              {selectedLead ? (
                selectedIsArchived ? (
                  <ReplyArchivedDetail
                    key={`arch-${selectedLead.row_number}`}
                    lead={selectedLead}
                    thread={selectedThread}
                    syncError={syncError}
                    syncing={syncing}
                    onRestore={restoreLead}
                  />
                ) : (
                  <ReplyConversationView
                    key={selectedLead.row_number}
                    lead={selectedLead}
                    cardState={getCard(selectedLead.row_number)}
                    thread={selectedThread}
                    syncError={syncError}
                    syncing={syncing}
                    isConfirming={archiveConfirm === selectedLead.row_number}
                    textareaRef={textareaRef}
                    onToggleArchiveConfirm={rowNumber =>
                      setArchiveConfirm(prev => (prev === rowNumber ? null : rowNumber))
                    }
                    onArchive={archiveLead}
                    onCancelArchive={() => setArchiveConfirm(null)}
                    onUpdateCard={updateCard}
                    onSend={handleSend}
                    onKeyDown={handleKeyDown}
                    onAiPromptChange={handleAiPromptChange}
                    onAiAssist={handleAIAssist}
                  />
                )
              ) : (
                <motion.div
                  key="empty"
                  className="replies-inbox-empty-detail"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <MessageCircle size={40} className="rc-empty-hint__icon mx-auto" aria-hidden />
                  <p className="m-0">Select a conversation</p>
                  <p className="m-0 text-sm opacity-60">Your AI communications workspace will open here</p>
                </motion.div>
              )}
            </AnimatePresence>
          </ReplyInbox>
        ) : null}
      </div>
      </div>
    </div>
  );
}
