import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, CheckCircle2, AlertCircle, Archive } from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ReplyPageHeader from './Replies/ReplyPageHeader.jsx';
import ReplyInbox from './Replies/ReplyInbox.jsx';
import ReplyConversationView from './Replies/ReplyConversationView.jsx';
import ReplyArchivedDetail from './Replies/ReplyArchivedDetail.jsx';
import { useReplyArchive } from './Replies/useReplyArchive.js';
import { useReplyCardState } from './Replies/useReplyCardState.js';
import { useReplySelection } from './Replies/useReplySelection.js';
import { useConversationThreads } from './Replies/useConversationThreads.js';
import { useUnreadReplies } from './Replies/useUnreadReplies.js';
import { buildThread, archKey, getConversationSortTime } from './Replies/threadUtils.js';

function hasConversationSignal(lead) {
  const sms = (lead.sms_reply || '').trim();
  const email = (lead.email_reply || '').trim();
  return (sms.length > 0 && sms !== '.') || (email.length > 0 && email !== '.');
}

export default function Replies() {
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

  const searched = sortedLeads.filter(l => {
    if (!showArchived && archived.has(archKey(l))) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const msgs = threads[l.row_number] || [];
    const inThread = msgs.some(m => (m.body || '').toLowerCase().includes(q));
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.sms_reply || '').toLowerCase().includes(q) ||
      (l.email_reply || '').toLowerCase().includes(q) ||
      inThread
    );
  });

  const activeLeads = searched.filter(l => !archived.has(archKey(l)));
  const archivedLeads = searched.filter(l => archived.has(archKey(l)));

  const {
    selectedRowNumber,
    selectLead: selectLeadBase,
    clearSelection,
    selectAfterArchive,
    isArchivedLead,
    detailOpen,
  } = useReplySelection({ activeLeads, archivedLeads, showArchived, loading });

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
    if (result?.lastReadInboundKey != null) {
      patchMeta(lead.row_number, {
        lastReadInboundKey: result.lastReadInboundKey,
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

  async function handleAIDraft(lead) {
    const messages = getMessages(lead.row_number);
    const uiThread = buildThread(lead, {}, messages);
    const outboundCount = messages.filter(
      m => m.direction === 'outbound' && !m.meta?.isTemplate,
    ).length;

    let followUpStep = 'initial_outreach';
    if (outboundCount === 1) followUpStep = 'follow_up_1';
    else if (outboundCount === 2) followUpStep = 'follow_up_2';
    else if (outboundCount >= 3) followUpStep = 'final_follow_up';

    const latestInbound = [...messages].reverse().find(m => m.direction === 'inbound');
    const hasReply = !!latestInbound;
    if (hasReply && followUpStep === 'initial_outreach') followUpStep = 'follow_up_1';

    const notesLower = (lead.notes || '').toLowerCase();
    if (notesLower.includes('ag') || notesLower.includes('agreement')) {
      followUpStep = 'agreement_follow_up';
    }

    const leadContext = {
      name: lead.name || null,
      phone: lead.phone || null,
      email: lead.email || null,
      town: null,
      address: null,
      reason: lead.reason || null,
      pest_type: null,
      lead_source: null,
      lead_stage: lead.status || 'customer_replied',
      status: lead.status || null,
      notes: lead.notes || null,
      sms_reply: hasReply,
      email_reply: messages.some(m => m.direction === 'inbound' && m.channel === 'email'),
      last_customer_message: latestInbound?.body || lead.sms_reply || null,
      prior_chat_history: uiThread
        .filter(m => !m.isTemplate)
        .map(m => ({
          role: m.dir === 'in' ? 'customer' : 'agent',
          text: m.text,
          ts: m.ts,
          channel: m.channel,
        })),
      last_contacted_at: lead.sent || null,
      follow_up_step: followUpStep,
      agreement_sent: false,
      quote_sent: false,
      scheduled_date: null,
      scheduled_window: null,
      preferred_contact_method: 'sms',
      stop: !!(lead.stop && String(lead.stop).trim()),
      reply_archived: archived.has(archKey(lead)),
      route_availability_context: null,
      human_review_required: false,
    };

    updateCard(lead.row_number, {
      drafting: true, draftError: null, reviewRequired: false, reviewReason: null,
    });

    try {
      const result = await api.ai.draftReply(leadContext);
      updateCard(lead.row_number, {
        drafting: false,
        message: result.draft || '',
        sent: false,
        error: null,
        reviewRequired: result.human_review_required || false,
        reviewReason: result.review_reason || null,
      });
      document.getElementById(`reply-ta-${lead.row_number}`)?.focus();
    } catch (err) {
      updateCard(lead.row_number, { drafting: false, draftError: err.message });
    }
  }

  const showInbox = !loading && leads.length > 0 && (activeLeads.length > 0 || (showArchived && archivedLeads.length > 0));

  return (
    <div className="replies-page flex-1 flex flex-col min-h-0 overflow-hidden">
      <ReplyPageHeader
        loading={loading}
        leadsCount={leads.length}
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
          <div className="flex justify-center py-20"><Spinner size={28} /></div>
        ) : leads.length === 0 ? (
          <div className="px-6 py-5">
            <EmptyState
              icon={MessageCircle}
              title="No replies yet"
              desc="When customers reply via SMS or email, conversations will appear here"
            />
          </div>
        ) : activeLeads.length === 0 && !showArchived ? (
          <div className="px-6 py-5">
            <EmptyState
              icon={Archive}
              title="All chats archived"
              desc="Toggle archived in the header to view them"
            />
          </div>
        ) : searched.length === 0 ? (
          <div className="px-6 py-5">
            <EmptyState icon={MessageCircle} title="No matches" desc={`No replies match "${search}"`} />
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
                    onAIDraft={handleAIDraft}
                  />
                )
              ) : (
                <motion.p
                  key="empty"
                  className="replies-inbox-empty-detail"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Select a conversation to view the full thread
                </motion.p>
              )}
            </AnimatePresence>
          </ReplyInbox>
        ) : null}
      </div>
    </div>
  );
}
