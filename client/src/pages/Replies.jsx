import { useEffect, useState, useRef } from 'react';
import {
  MessageCircle, RefreshCw, Search, Send, CheckCircle2,
  AlertCircle, Zap, X, Archive, RotateCcw, Clock,
  Bot, AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';

const ARCHIVE_KEY = 'gs_archived_replies';
const HISTORY_KEY  = 'gs_chat_msgs';

const TMPL_LABEL = { na: 'No-Answer follow-up sent', ag: 'Agreement follow-up sent', ch: 'Check-in sent' };
const TMPL_COLOR = { na: '#16A34A', ag: '#2563EB', ch: '#D97706' };

const QUICK_REPLIES = [
  { label: 'Confirm',    text: "Sounds great! When would work best for you? We can usually get you scheduled within a few days." },
  { label: 'Schedule',   text: "I'd love to get you set up! Do you prefer mornings or afternoons?" },
  { label: 'Agreement',  text: "Perfect! I'll send over the service agreement for you to review shortly." },
  { label: 'Follow up',  text: "Just checking in — are you still interested in getting started? Happy to answer any questions!" },
  { label: 'Call me',    text: "Happy to chat! Feel free to give us a call anytime. What's your best time to talk?" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function formatSent(sent) {
  if (!sent || sent === 'imported') return null;
  const d = new Date(sent);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatThreadTime(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString())     return `Today · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` · ${time}`;
}

const archKey = l => `${l.row_number}:${l.sms_reply}`;

function buildThread(lead, history) {
  const h = history[lead.row_number] || {};
  const msgs = [];

  if (lead.sent && lead.sent !== 'imported') {
    const k = (lead.notes || '').toLowerCase().trim();
    msgs.push({
      id: 'tmpl', dir: 'out', isTemplate: true,
      text: TMPL_LABEL[k] || 'Initial message sent',
      color: TMPL_COLOR[k] || '#64748B',
      ts: lead.sent,
    });
  }

  (h.outbound || []).forEach((m, i) =>
    msgs.push({ id: `out-${i}`, dir: 'out', text: m.text, ts: m.ts })
  );

  const reply = (lead.sms_reply || '').trim();
  if (reply && reply !== '.') {
    msgs.push({ id: 'inbound', dir: 'in', text: reply, ts: h.inboundDetectedAt || null });
  }

  return msgs.sort((a, b) => {
    if (!a.ts && !b.ts) return 0;
    if (!a.ts) return 1;
    if (!b.ts) return -1;
    return new Date(a.ts) - new Date(b.ts);
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ChatMessage({ msg }) {
  const isOut   = msg.dir === 'out';
  const timeStr = formatThreadTime(msg.ts);

  if (msg.isTemplate) {
    return (
      <div className="flex justify-center my-1.5">
        <div style={{
          background: `${msg.color}12`,
          border: `1px solid ${msg.color}30`,
          borderRadius: '20px',
          padding: '3px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          maxWidth: '92%',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: msg.color, flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: msg.color, fontWeight: 600, lineHeight: 1.5 }}>
            {msg.text}
          </span>
          {timeStr && (
            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: 2, flexShrink: 0 }}>
              {timeStr}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col mb-2 ${isOut ? 'items-end' : 'items-start'}`}>
      {timeStr && (
        <span style={{
          fontSize: '10px', color: '#94a3b8', marginBottom: '3px',
          marginLeft: isOut ? 0 : '4px', marginRight: isOut ? '4px' : 0,
        }}>
          {isOut ? `You · ${timeStr}` : `Customer · ${timeStr}`}
        </span>
      )}
      <div style={{
        maxWidth: '82%',
        padding: '8px 12px',
        borderRadius: isOut ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
        background: isOut
          ? 'linear-gradient(135deg, rgba(22,163,74,0.13), rgba(22,163,74,0.06))'
          : 'rgba(37,99,235,0.07)',
        border: isOut
          ? '1px solid rgba(22,163,74,0.22)'
          : '1px solid rgba(37,99,235,0.16)',
        fontSize: '13px',
        lineHeight: '1.55',
        color: '#0f172a',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.text}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Replies() {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [cardState, setCardState] = useState({});
  const [toast, setToast]     = useState(null);
  const firstTextareaRef      = useRef(null);

  // Archive
  const [archived, setArchived] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const [showArchived, setShowArchived]   = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(null); // row_number

  // Chat history
  const [chatHistory, setChatHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); }
    catch { return {}; }
  });
  const historyRef = useRef(chatHistory);
  useEffect(() => { historyRef.current = chatHistory; }, [chatHistory]);

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── History helpers ────────────────────────────────────────────────────────

  function updateHistory(updater) {
    const next = updater(historyRef.current);
    historyRef.current = next;
    setChatHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  function recordReplyDetected(lead) {
    const reply = (lead.sms_reply || '').trim();
    if (!reply || reply === '.') return;
    const h = historyRef.current[lead.row_number] || {};
    if (h.lastReply === reply) return; // already tracked this reply
    updateHistory(prev => ({
      ...prev,
      [lead.row_number]: {
        outbound: [],
        inboundDetectedAt: null,
        ...prev[lead.row_number],
        inboundDetectedAt: (prev[lead.row_number]?.lastReply === reply)
          ? (prev[lead.row_number]?.inboundDetectedAt || new Date().toISOString())
          : new Date().toISOString(),
        lastReply: reply,
      },
    }));
  }

  function saveSentMessage(rowNumber, text) {
    updateHistory(prev => {
      const entry = prev[rowNumber] || { outbound: [], inboundDetectedAt: null, lastReply: null };
      return {
        ...prev,
        [rowNumber]: { ...entry, outbound: [...entry.outbound, { text, ts: new Date().toISOString() }] },
      };
    });
  }

  // ── Data loading ───────────────────────────────────────────────────────────

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

  // Mark all loaded replies as viewed — clears sidebar badge
  useEffect(() => {
    if (!loading && leads.length > 0) {
      window.dispatchEvent(new CustomEvent('replies-viewed', {
        detail: leads.map(l => `${l.row_number}:${l.sms_reply}`),
      }));
    }
  }, [loading, leads]);

  // Auto-focus first textarea
  useEffect(() => {
    if (!loading && leads.length > 0) {
      const t = setTimeout(() => firstTextareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // ── Card state ─────────────────────────────────────────────────────────────

  function getCard(rowNumber) {
    return cardState[rowNumber] || {
      message: '', sending: false, sent: false, error: null, sentAt: null,
      drafting: false, draftError: null, reviewRequired: false, reviewReason: null,
    };
  }

  function updateCard(rowNumber, patch) {
    setCardState(prev => ({ ...prev, [rowNumber]: { ...prev[rowNumber], ...patch } }));
  }

  // ── SMS send ───────────────────────────────────────────────────────────────

  async function handleSend(lead) {
    const cs  = getCard(lead.row_number);
    const msg = (cs.message || '').trim();
    if (!msg || cs.sending) return;

    updateCard(lead.row_number, { sending: true, error: null });
    try {
      await api.sms.send(lead.phone, msg, lead.row_number, lead.name);
      saveSentMessage(lead.row_number, msg);
      updateCard(lead.row_number, { message: '', sending: false, sent: true, error: null, sentAt: new Date() });
      showToast(`SMS sent to ${lead.name}`);
    } catch (err) {
      updateCard(lead.row_number, { sending: false, error: err.message });
    }
  }

  function handleKeyDown(e, lead) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(lead); }
  }

  function applyQuickReply(rowNumber, text) {
    updateCard(rowNumber, { message: text, sent: false, error: null });
    document.getElementById(`reply-ta-${rowNumber}`)?.focus();
  }

  async function handleAIDraft(lead) {
    const h = historyRef.current[lead.row_number] || {};
    const outboundCount = (h.outbound || []).length;

    // Infer follow-up step from outbound history and lead state
    let followUpStep = 'initial_outreach';
    if (outboundCount === 1) followUpStep = 'follow_up_1';
    else if (outboundCount === 2) followUpStep = 'follow_up_2';
    else if (outboundCount >= 3) followUpStep = 'final_follow_up';

    // If they replied, we're responding to them regardless of outbound count
    const hasReply = !!(lead.sms_reply && lead.sms_reply.trim());
    if (hasReply && followUpStep === 'initial_outreach') followUpStep = 'follow_up_1';

    // Detect agreement context from notes
    const notesLower = (lead.notes || '').toLowerCase();
    if (notesLower.includes('ag') || notesLower.includes('agreement')) {
      followUpStep = 'agreement_follow_up';
    }

    const leadContext = {
      name:                   lead.name || null,
      phone:                  lead.phone || null,
      email:                  lead.email || null,
      town:                   null,
      address:                null,
      reason:                 lead.reason || null,
      pest_type:              null,
      lead_source:            null,
      lead_stage:             lead.status || 'customer_replied',
      status:                 lead.status || null,
      notes:                  lead.notes || null,
      sms_reply:              hasReply,
      email_reply:            !!(lead.email_reply && lead.email_reply.trim()),
      last_customer_message:  lead.sms_reply || null,
      prior_chat_history:     h.outbound || [],
      last_contacted_at:      lead.sent || null,
      follow_up_step:         followUpStep,
      agreement_sent:         false,
      quote_sent:             false,
      scheduled_date:         null,
      scheduled_window:       null,
      preferred_contact_method: 'sms',
      stop:                   !!(lead.stop && String(lead.stop).trim()),
      reply_archived:         archived.has(archKey(lead)),
      route_availability_context: null,
      human_review_required:  false,
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
        reviewReason:   result.review_reason || null,
      });
      document.getElementById(`reply-ta-${lead.row_number}`)?.focus();
    } catch (err) {
      updateCard(lead.row_number, { drafting: false, draftError: err.message });
    }
  }

  // ── Archive ────────────────────────────────────────────────────────────────

  function archiveLead(lead) {
    setArchived(prev => {
      const next = new Set(prev);
      next.add(archKey(lead));
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...next]));
      return next;
    });
    setArchiveConfirm(null);
  }

  function restoreLead(lead) {
    setArchived(prev => {
      const next = new Set(prev);
      next.delete(archKey(lead));
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  // ── Filtered lists ─────────────────────────────────────────────────────────

  const searched = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.sms_reply || '').toLowerCase().includes(q)
    );
  });

  const activeLeads   = searched.filter(l => !archived.has(archKey(l)));
  const archivedLeads = searched.filter(l =>  archived.has(archKey(l)));
  const archivedCount = archived.size;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">

      {/* Page header */}
      <div
        className="px-6 py-5 bg-gs-bg border-b border-gs-border flex items-center justify-between sticky top-0 z-10"
        style={{ backdropFilter: 'blur(8px)', background: 'rgba(243,247,241,0.92)' }}
      >
        <div>
          <h1 className="text-lg font-bold text-gs-text flex items-center gap-2">
            <MessageCircle size={18} className="text-gs-accent" />
            SMS Replies
          </h1>
          <p className="text-gs-muted text-xs mt-0.5">
            {loading
              ? 'Loading…'
              : `${leads.length} customer${leads.length !== 1 ? 's' : ''} with inbound replies`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className="btn-ghost text-xs gap-1.5"
              style={{ color: showArchived ? '#7C3AED' : undefined }}
            >
              <Archive size={13} />
              {showArchived ? 'Hide archived' : `${archivedCount} archived`}
            </button>
          )}
          <button onClick={loadLeads} disabled={loading} className="btn-ghost text-xs gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-6 py-5 animate-fade-in-up">

        {/* Toast */}
        {toast && (
          <div className={`mb-5 px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2 ${
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

        {/* Search */}
        {!loading && leads.length > 0 && (
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted pointer-events-none" />
            <input
              className="input pl-9 pr-8 text-sm"
              placeholder="Search by name, phone, or message…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gs-muted hover:text-gs-text transition-colors"
                tabIndex={-1}
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Loading / empty states */}
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
            {/* Active cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {activeLeads.map((lead, idx) => {
                const cs       = getCard(lead.row_number);
                const sentDate = formatSent(lead.sent);
                const thread   = buildThread(lead, chatHistory);
                const isConfirming = archiveConfirm === lead.row_number;

                return (
                  <div
                    key={lead.row_number}
                    className="card flex flex-col gap-0 overflow-hidden"
                    style={{ padding: 0 }}
                  >
                    {/* Archive confirm bar */}
                    {isConfirming && (
                      <div style={{
                        background: 'rgba(220,38,38,0.06)',
                        borderBottom: '1px solid rgba(220,38,38,0.18)',
                        padding: '10px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}>
                        <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 500 }}>
                          Archive this chat? It won't appear in your active list.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => archiveLead(lead)}
                            style={{
                              fontSize: '11px', fontWeight: 600, color: '#fff',
                              background: '#DC2626', border: 'none', borderRadius: '6px',
                              padding: '4px 10px', cursor: 'pointer',
                            }}
                          >
                            Archive
                          </button>
                          <button
                            onClick={() => setArchiveConfirm(null)}
                            style={{
                              fontSize: '11px', fontWeight: 500, color: '#64748b',
                              background: 'transparent', border: '1px solid rgba(15,42,20,0.12)',
                              borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-4" style={{ padding: '1.25rem' }}>

                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: 'linear-gradient(135deg, rgba(22,163,74,0.18), rgba(22,163,74,0.08))',
                              border: '1px solid rgba(22,163,74,0.22)',
                            }}
                          >
                            <span className="text-xs font-bold text-gs-accent">{initials(lead.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gs-text text-sm leading-tight truncate">
                              {lead.name || 'Unknown'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {lead.phone && (
                                <span className="text-xs font-mono text-gs-muted">{lead.phone}</span>
                              )}
                              {sentDate && lead.phone && <span className="text-gs-border text-xs">·</span>}
                              {sentDate && (
                                <span className="text-xs text-gs-muted">Sent {sentDate}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {lead.status && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                              style={{
                                background: 'rgba(22,163,74,0.10)',
                                border: '1px solid rgba(22,163,74,0.22)',
                                color: '#15803d',
                              }}
                            >
                              {lead.status}
                            </span>
                          )}
                          <button
                            onClick={() => setArchiveConfirm(isConfirming ? null : lead.row_number)}
                            title="Archive this chat"
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              padding: '4px', borderRadius: '6px',
                              color: isConfirming ? '#DC2626' : '#94a3b8',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => { if (!isConfirming) e.currentTarget.style.color = '#DC2626'; }}
                            onMouseLeave={e => { if (!isConfirming) e.currentTarget.style.color = '#94a3b8'; }}
                          >
                            <Archive size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="h-px bg-gs-border" />

                      {/* Chat history thread */}
                      <div>
                        <div className="section-label mb-2">
                          <span className="section-label-bar" style={{ background: '#7C3AED' }} />
                          <Clock size={10} style={{ color: '#7C3AED', marginRight: 2 }} />
                          Chat History
                        </div>
                        <div
                          style={{
                            maxHeight: '260px',
                            overflowY: 'auto',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'rgba(248,250,252,0.8)',
                            border: '1px solid rgba(226,232,240,0.7)',
                          }}
                        >
                          {thread.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                              No history yet
                            </p>
                          ) : (
                            thread.map(msg => <ChatMessage key={msg.id} msg={msg} />)
                          )}
                        </div>
                      </div>

                      {/* Your reply textarea */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <div className="section-label" style={{ marginBottom: 0 }}>
                            <span className="section-label-bar bg-gs-accent" />
                            Your Reply
                          </div>
                          <button
                            onClick={() => handleAIDraft(lead)}
                            disabled={cs.drafting}
                            title="Generate AI draft reply"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              fontSize: '11px', fontWeight: 600,
                              color: cs.drafting ? '#94a3b8' : '#7C3AED',
                              background: cs.drafting ? 'rgba(124,58,237,0.04)' : 'rgba(124,58,237,0.08)',
                              border: '1px solid rgba(124,58,237,0.22)',
                              borderRadius: '8px', padding: '3px 9px',
                              cursor: cs.drafting ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (!cs.drafting) { e.currentTarget.style.background = 'rgba(124,58,237,0.14)'; e.currentTarget.style.color = '#6D28D9'; }}}
                            onMouseLeave={e => { if (!cs.drafting) { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.color = '#7C3AED'; }}}
                          >
                            {cs.drafting ? <Spinner size={10} /> : <Bot size={11} />}
                            {cs.drafting ? 'Drafting…' : 'AI Draft'}
                          </button>
                        </div>
                        <textarea
                          id={`reply-ta-${lead.row_number}`}
                          ref={idx === 0 ? firstTextareaRef : null}
                          rows={3}
                          className="input resize-none text-sm leading-relaxed"
                          placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
                          value={cs.message}
                          disabled={cs.sending}
                          onChange={e => updateCard(lead.row_number, { message: e.target.value, sent: false, error: null })}
                          onKeyDown={e => handleKeyDown(e, lead)}
                        />
                      </div>

                      {/* Quick reply pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Zap size={11} className="text-gs-muted shrink-0" />
                        {QUICK_REPLIES.map(qr => (
                          <button
                            key={qr.label}
                            onClick={() => applyQuickReply(lead.row_number, qr.text)}
                            className="text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-all duration-150"
                            style={{
                              border: '1px solid rgba(15,42,20,0.12)',
                              color: '#64748b',
                              background: 'rgba(255,255,255,0.72)',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = '#16a34a';
                              e.currentTarget.style.borderColor = 'rgba(22,163,74,0.35)';
                              e.currentTarget.style.background = 'rgba(22,163,74,0.06)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = '#64748b';
                              e.currentTarget.style.borderColor = 'rgba(15,42,20,0.12)';
                              e.currentTarget.style.background = 'rgba(255,255,255,0.72)';
                            }}
                          >
                            {qr.label}
                          </button>
                        ))}
                      </div>

                      {/* Draft error */}
                      {cs.draftError && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px', borderRadius: '10px',
                          background: 'rgba(220,38,38,0.07)',
                          border: '1px solid rgba(220,38,38,0.22)',
                          fontSize: '12px', color: '#DC2626',
                        }}>
                          <AlertCircle size={13} style={{ flexShrink: 0 }} />
                          AI draft failed: {cs.draftError}
                        </div>
                      )}

                      {/* Human review warning */}
                      {cs.reviewRequired && (
                        <div style={{
                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                          padding: '10px 14px', borderRadius: '10px',
                          background: 'rgba(217,119,6,0.08)',
                          border: '1px solid rgba(217,119,6,0.28)',
                        }}>
                          <AlertTriangle size={14} style={{ color: '#D97706', marginTop: '1px', flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#B45309', margin: 0, marginBottom: '2px' }}>
                              Human review recommended before sending
                            </p>
                            {cs.reviewReason && (
                              <p style={{ fontSize: '11px', color: '#92400E', margin: 0, lineHeight: 1.45 }}>
                                {cs.reviewReason}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs min-w-0">
                          {cs.sent && !cs.error && (
                            <span className="flex items-center gap-1 text-gs-accent font-medium">
                              <CheckCircle2 size={13} className="shrink-0" />
                              SMS sent{cs.sentAt ? ` · ${formatTime(cs.sentAt)}` : ''}
                            </span>
                          )}
                          {cs.error && (
                            <span className="flex items-center gap-1 text-gs-danger font-medium break-words">
                              <AlertCircle size={13} className="shrink-0" />
                              {cs.error}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleSend(lead)}
                          disabled={!cs.message?.trim() || cs.sending}
                          className="btn-primary text-xs py-1.5 px-4 gap-1.5 shrink-0"
                        >
                          {cs.sending ? (
                            <><Spinner size={12} />Sending…</>
                          ) : (
                            <><Send size={12} />Send SMS</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Archived cards section */}
            {showArchived && archivedLeads.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Archive size={14} style={{ color: '#7C3AED' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Archived ({archivedLeads.length})
                  </span>
                  <div className="h-px flex-1 bg-gs-border" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {archivedLeads.map(lead => {
                    const sentDate = formatSent(lead.sent);
                    return (
                      <div
                        key={lead.row_number}
                        className="card flex flex-col gap-4"
                        style={{ padding: '1.25rem', opacity: 0.72 }}
                      >
                        {/* Archived card header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{
                                background: 'rgba(100,116,139,0.10)',
                                border: '1px solid rgba(100,116,139,0.20)',
                              }}
                            >
                              <span className="text-xs font-bold" style={{ color: '#64748b' }}>{initials(lead.name)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gs-text text-sm leading-tight truncate">
                                {lead.name || 'Unknown'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {lead.phone && (
                                  <span className="text-xs font-mono text-gs-muted">{lead.phone}</span>
                                )}
                                {sentDate && lead.phone && <span className="text-gs-border text-xs">·</span>}
                                {sentDate && (
                                  <span className="text-xs text-gs-muted">Sent {sentDate}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => restoreLead(lead)}
                            title="Restore to active"
                            className="btn-ghost text-xs gap-1 shrink-0"
                            style={{ color: '#7C3AED' }}
                          >
                            <RotateCcw size={12} />
                            Restore
                          </button>
                        </div>

                        <div className="h-px bg-gs-border" />

                        {/* Their reply — read only */}
                        <div>
                          <div className="section-label mb-2">
                            <span className="section-label-bar bg-gs-info" />
                            Their Reply
                          </div>
                          <div
                            className="rounded-xl px-4 py-3"
                            style={{
                              background: 'rgba(37,99,235,0.05)',
                              border: '1px solid rgba(37,99,235,0.15)',
                            }}
                          >
                            <p className="text-sm text-gs-text leading-relaxed whitespace-pre-wrap break-words">
                              {lead.sms_reply}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
