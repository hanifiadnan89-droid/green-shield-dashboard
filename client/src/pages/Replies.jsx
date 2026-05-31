import { useEffect, useState, useRef } from 'react';
import { MessageCircle, Search, CheckCircle2, AlertCircle, X, Archive } from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ReplyPageHeader from './Replies/ReplyPageHeader.jsx';
import ReplyCard from './Replies/ReplyCard.jsx';
import ArchivedReplyCard from './Replies/ArchivedReplyCard.jsx';
import { useChatHistory } from './Replies/useChatHistory.js';
import { useReplyArchive } from './Replies/useReplyArchive.js';
import { useReplyCardState } from './Replies/useReplyCardState.js';
import { buildThread, formatSent, archKey } from './Replies/threadUtils.js';

export default function Replies() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const firstTextareaRef = useRef(null);

  const { chatHistory, historyRef, recordReplyDetected, saveSentMessage } = useChatHistory();
  const {
    archived,
    showArchived,
    setShowArchived,
    archiveConfirm,
    setArchiveConfirm,
    archiveLead,
    restoreLead,
    archivedCount,
  } = useReplyArchive();
  const { getCard, updateCard } = useReplyCardState();

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
    if (!loading && leads.length > 0) {
      const t = setTimeout(() => firstTextareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [loading, leads.length]);

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

  const searched = leads.filter(l => {
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

  return (
    <div className="flex-1 overflow-y-auto">
      <ReplyPageHeader
        loading={loading}
        leadsCount={leads.length}
        archivedCount={archivedCount}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived(v => !v)}
        onRefresh={loadLeads}
      />

      <div className="px-6 py-5 animate-fade-in-up">
        {toast && (
          <div className={`mb-5 px-4 py-2.5 rounded-xl type-body-sm font-medium border flex items-center gap-2 ${
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

        {!loading && leads.length > 0 && (
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted pointer-events-none" />
            <input
              className="input pl-9 pr-8 type-body-sm"
              placeholder="Search by name, phone, or message…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gs-muted hover:text-gs-text transition-colors"
                tabIndex={-1}
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No SMS replies yet"
            desc="When customers reply to your texts, they'll appear here automatically"
          />
        ) : activeLeads.length === 0 && !showArchived ? (
          <EmptyState
            icon={Archive}
            title="All chats archived"
            desc="Toggle 'archived' in the header to view them"
          />
        ) : searched.length === 0 ? (
          <EmptyState icon={Search} title="No matches" desc={`No replies match "${search}"`} />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              {activeLeads.map((lead, idx) => (
                <ReplyCard
                  key={lead.row_number}
                  lead={lead}
                  cardState={getCard(lead.row_number)}
                  thread={buildThread(lead, chatHistory)}
                  sentDate={formatSent(lead.sent)}
                  isConfirming={archiveConfirm === lead.row_number}
                  textareaRef={idx === 0 ? firstTextareaRef : null}
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
              ))}
            </div>

            {showArchived && archivedLeads.length > 0 && (
              <div className="mt-8 sm:mt-10">
                <div className="flex items-center gap-2 mb-4 sm:mb-5">
                  <Archive size={14} className="text-violet-700 shrink-0" />
                  <span className="type-label-sm uppercase tracking-widest text-violet-700">
                    Archived ({archivedLeads.length})
                  </span>
                  <div className="h-px flex-1 bg-gs-border" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                  {archivedLeads.map(lead => (
                    <ArchivedReplyCard
                      key={lead.row_number}
                      lead={lead}
                      sentDate={formatSent(lead.sent)}
                      onRestore={restoreLead}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
