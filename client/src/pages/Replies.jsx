import { useEffect, useState, useRef } from 'react';
import {
  MessageCircle, RefreshCw, Search, Send, CheckCircle2,
  AlertCircle, Zap, X
} from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';

const QUICK_REPLIES = [
  {
    label: 'Confirm',
    text: "Sounds great! When would work best for you? We can usually get you scheduled within a few days.",
  },
  {
    label: 'Schedule',
    text: "I'd love to get you set up! Do you prefer mornings or afternoons?",
  },
  {
    label: 'Agreement',
    text: "Perfect! I'll send over the service agreement for you to review shortly.",
  },
  {
    label: 'Follow up',
    text: "Just checking in — are you still interested in getting started? Happy to answer any questions!",
  },
  {
    label: 'Call me',
    text: "Happy to chat! Feel free to give us a call anytime. What's your best time to talk?",
  },
];

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

export default function Replies() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cardState, setCardState] = useState({});
  const [toast, setToast] = useState(null);
  const firstTextareaRef = useRef(null);

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
      setLeads(replyLeads);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  // Mark all loaded replies as viewed — clears the sidebar badge
  useEffect(() => {
    if (!loading && leads.length > 0) {
      window.dispatchEvent(new CustomEvent('replies-viewed', {
        detail: leads.map(l => `${l.row_number}:${l.sms_reply}`),
      }));
    }
  }, [loading, leads]);

  // Auto-focus first textarea after initial load
  useEffect(() => {
    if (!loading && leads.length > 0) {
      const t = setTimeout(() => firstTextareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [loading]);

  function getCard(rowNumber) {
    return cardState[rowNumber] || { message: '', sending: false, sent: false, error: null, sentAt: null };
  }

  function updateCard(rowNumber, patch) {
    setCardState(prev => ({
      ...prev,
      [rowNumber]: { ...prev[rowNumber], ...patch },
    }));
  }

  async function handleSend(lead) {
    const cs = getCard(lead.row_number);
    const msg = (cs.message || '').trim();
    if (!msg || cs.sending) return;

    updateCard(lead.row_number, { sending: true, error: null });

    try {
      await api.sms.send(lead.phone, msg, lead.row_number, lead.name);
      updateCard(lead.row_number, {
        message: '',
        sending: false,
        sent: true,
        error: null,
        sentAt: new Date(),
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

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.sms_reply || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto">

      {/* Page header */}
      <div className="px-6 py-5 bg-gs-bg border-b border-gs-border flex items-center justify-between sticky top-0 z-10"
           style={{ backdropFilter: 'blur(8px)', background: 'rgba(243,247,241,0.92)' }}>
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
        <button
          onClick={loadLeads}
          disabled={loading}
          className="btn-ghost text-xs gap-1.5"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
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

        {/* Search bar */}
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

        {/* States */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size={24} />
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No SMS replies yet"
            desc="When customers reply to your texts, they'll appear here automatically"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matches"
            desc={`No replies match "${search}"`}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.map((lead, idx) => {
              const cs = getCard(lead.row_number);
              const sentDate = formatSent(lead.sent);

              return (
                <div
                  key={lead.row_number}
                  className="card flex flex-col gap-4"
                  style={{ padding: '1.25rem' }}
                >

                  {/* Card header: avatar + name + phone */}
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
                          {sentDate && lead.phone && (
                            <span className="text-gs-border text-xs">·</span>
                          )}
                          {sentDate && (
                            <span className="text-xs text-gs-muted">Sent {sentDate}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {lead.status && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 capitalize"
                        style={{
                          background: 'rgba(22,163,74,0.10)',
                          border: '1px solid rgba(22,163,74,0.22)',
                          color: '#15803d',
                        }}
                      >
                        {lead.status}
                      </span>
                    )}
                  </div>

                  <div className="h-px bg-gs-border" />

                  {/* Their inbound reply */}
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

                  {/* Reply textarea */}
                  <div>
                    <div className="section-label mb-2">
                      <span className="section-label-bar bg-gs-accent" />
                      Your Reply
                    </div>
                    <textarea
                      id={`reply-ta-${lead.row_number}`}
                      ref={idx === 0 ? firstTextareaRef : null}
                      rows={3}
                      className="input resize-none text-sm leading-relaxed"
                      placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
                      value={cs.message}
                      disabled={cs.sending}
                      onChange={e =>
                        updateCard(lead.row_number, { message: e.target.value, sent: false, error: null })
                      }
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

                  {/* Footer: status feedback + send button */}
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
                        <>
                          <Spinner size={12} />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          Send SMS
                        </>
                      )}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
