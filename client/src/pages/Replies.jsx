import { useEffect, useState, useRef } from 'react';
import { MessageCircle, CheckCircle2, AlertCircle, Archive } from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ReplyPageHeader from './Replies/ReplyPageHeader.jsx';
import ReplyInbox from './Replies/ReplyInbox.jsx';
import ReplyConversationView from './Replies/ReplyConversationView.jsx';
import ReplyArchivedDetail from './Replies/ReplyArchivedDetail.jsx';
import { useChatHistory } from './Replies/useChatHistory.js';
import { useReplyArchive } from './Replies/useReplyArchive.js';
import { useReplyCardState } from './Replies/useReplyCardState.js';
import { useReplySelection } from './Replies/useReplySelection.js';
import { buildThread, archKey } from './Replies/threadUtils.js';

export default function Replies() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const textareaRef = useRef(null);

  const { chatHistory, historyRef, recordReplyDetected, saveSentMessage } = useChatHistory();
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

  const searched = leads.filter(l => {
    if (!showArchived && archived.has(archKey(l))) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.sms_reply || '').toLowerCase().includes(q)
    );
  });

  const activeLeads = searched.filter(l => !archived.has(archKey(l)));
  const archivedLeads = searched.filter(l => archived.has(archKey(l)));

  const {
    selectedRowNumber,
    selectLead,
    clearSelection,
    selectAfterArchive,
    isArchivedLead,
    detailOpen,
  } = useReplySelection({ activeLeads, archivedLeads, showArchived, loading });

  const selectedLead = leads.find(l => l.row_number === selectedRowNumber) ?? null;
  const selectedIsArchived = selectedLead ? isArchivedLead(selectedLead, archived) : false;

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadLeads() {
    setLoading(true);
    try {
      const { leads: all } = await api.leads.list();
      const replyLeads = (all || []).filter(l => {
        const t = (l.sms_reply || '').trim();
        return t.length > 0 && t !== '.';
      });
      replyLeads.sort((a, b) => {
        const da = a.sent && a.sent !== 'imported' ? new Date(a.sent).getTime() : 0;
        const db = b.sent && b.sent !== 'imported' ? new Date(b.sent).getTime() : 0;
        return db - da;
      });
      replyLeads.forEach(l => recordReplyDetected(l));
      setLeads(replyLeads);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLeads(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && leads.length > 0) {
      window.dispatchEvent(new CustomEvent('replies-viewed', {
        detail: leads.map(l => `${l.row_number}:${l.sms_reply}`),
      }));
    }
  }, [loading, leads]);

  useEffect(() => {
    if (!loading && selectedLead && !selectedIsArchived && textareaRef.current) {
      const t = setTimeout(() => textareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [loading, selectedRowNumber, selectedIsArchived]);

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
      await api.sms.send(lead.phone, msg, lead.row_number, lead.name);
      saveSentMessage(lead.row_number, msg);
      updateCard(lead.row_number, {
        message: '', sending: false, sent: true, error: null, sentAt: new Date(),
      });
      showToast(`SMS sent to ${lead.name}`);
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

  function applyQuickReply(rowNumber, text) {
    updateCard(rowNumber, { message: text, sent: false, error: null });
    document.getElementById(`reply-ta-${rowNumber}`)?.focus();
  }

  async function handleAIDraft(lead) {
    const h = historyRef.current[lead.row_number] || {};
    const outboundCount = (h.outbound || []).length;

    let followUpStep = 'initial_outreach';
    if (outboundCount === 1) followUpStep = 'follow_up_1';
    else if (outboundCount === 2) followUpStep = 'follow_up_2';
    else if (outboundCount >= 3) followUpStep = 'final_follow_up';

    const hasReply = !!(lead.sms_reply && lead.sms_reply.trim());
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
      email_reply: !!(lead.email_reply && lead.email_reply.trim()),
      last_customer_message: lead.sms_reply || null,
      prior_chat_history: h.outbound || [],
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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

      {toast && (
        <div className={`mx-6 mt-3 px-4 py-2.5 rounded-xl type-body-sm font-medium border flex items-center gap-2 shrink-0 ${
          toast.type === 'error'
            ? 'bg-gs-danger/10 text-gs-danger border-gs-danger/25'
            : 'bg-gs-accent/10 text-gs-accent border-gs-accent/25'
        }`}>
          {toast.type === 'error'
            ? <AlertCircle size={14} className="shrink-0" />
            : <CheckCircle2 size={14} className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col animate-fade-in-up">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : leads.length === 0 ? (
          <div className="px-6 py-5">
            <EmptyState
              icon={MessageCircle}
              title="No SMS replies yet"
              desc="When customers reply to your texts, they'll appear here automatically"
            />
          </div>
        ) : activeLeads.length === 0 && !showArchived ? (
          <div className="px-6 py-5">
            <EmptyState
              icon={Archive}
              title="All chats archived"
              desc="Toggle 'archived' in the header to view them"
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
          >
            {selectedLead ? (
              selectedIsArchived ? (
                <ReplyArchivedDetail lead={selectedLead} onRestore={restoreLead} />
              ) : (
                <ReplyConversationView
                  lead={selectedLead}
                  cardState={getCard(selectedLead.row_number)}
                  thread={buildThread(selectedLead, chatHistory)}
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
                  onQuickReply={applyQuickReply}
                  onAIDraft={handleAIDraft}
                />
              )
            ) : (
              <p className="reply-inbox-empty-detail">
                Select a conversation from the list
              </p>
            )}
          </ReplyInbox>
        ) : null}
      </div>
    </div>
  );
}
