import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  X, Phone, Mail, Send, Hash, MessageSquare, Archive, ArchiveRestore,
  ExternalLink, TrendingUp, AlertCircle,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { hasRealReply } from '../CRMPreview/mockData.js';
import { getAvatarStyle, getInitials } from '../CRMPreview/mockData.js';
import { getActivityMeta } from '../CRMPreview/mockData.js';
import { formatThreadTime } from '../Replies/threadUtils.js';
import LeadStatusLabel from './LeadStatusLabel.jsx';
import { useLeadDetailData } from './useLeadDetailData.js';
import Spinner from '../../components/Spinner.jsx';

function InsightTile({ label, value, sub }) {
  return (
    <div className="leads-insight-tile">
      <p className="leads-insight-tile__label">{label}</p>
      <p className="leads-insight-tile__value">{value}</p>
      {sub && <p className="leads-insight-tile__sub">{sub}</p>}
    </div>
  );
}

function ConversationPreview({ thread, leadName }) {
  const recent = thread.slice(-6);
  if (!recent.length) return null;

  return (
    <section className="leads-detail-section">
      <h3 className="leads-detail-section__title">Recent conversation</h3>
      <div className="leads-conversation-preview">
        {recent.map(msg => {
          const isCustomer = msg.dir === 'in' || msg.direction === 'inbound';
          return (
            <div
              key={msg.id}
              className={`leads-conversation-preview__bubble ${isCustomer ? 'leads-conversation-preview__bubble--in' : 'leads-conversation-preview__bubble--out'}`}
            >
              <p className="leads-conversation-preview__who">
                {isCustomer ? (leadName || 'Customer') : 'Office'}
              </p>
              <p className="leads-conversation-preview__text">{msg.text}</p>
              {msg.ts && (
                <p className="leads-conversation-preview__time">{formatThreadTime(msg.ts)}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentResponses({ lead }) {
  const sms = hasRealReply(lead.sms_reply) ? lead.sms_reply.trim() : '';
  const email = hasRealReply(lead.email_reply) ? lead.email_reply.trim() : '';
  if (!sms && !email) return null;

  return (
    <section className="leads-detail-section">
      <h3 className="leads-detail-section__title">Recent customer responses</h3>
      <div className="space-y-3">
        {sms && (
          <div className="leads-response-snippet">
            <p className="leads-response-snippet__channel"><MessageSquare size={12} /> SMS</p>
            <p className="leads-response-snippet__body">&ldquo;{sms}&rdquo;</p>
          </div>
        )}
        {email && (
          <div className="leads-response-snippet">
            <p className="leads-response-snippet__channel"><Mail size={12} /> Email</p>
            <p className="leads-response-snippet__body">&ldquo;{email.length > 280 ? `${email.slice(0, 280)}…` : email}&rdquo;</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Timeline({ activity, thread }) {
  const items = [];

  for (const msg of [...thread].reverse().slice(0, 8)) {
    const isIn = msg.dir === 'in' || msg.direction === 'inbound';
    items.push({
      id: `msg-${msg.id}`,
      ts: msg.ts,
      label: isIn ? 'Customer replied' : msg.isTemplate ? 'Template sent' : 'Message sent',
      detail: msg.text?.length > 90 ? `${msg.text.slice(0, 90)}…` : msg.text,
      tone: isIn ? 'in' : 'out',
    });
  }

  for (const entry of activity.slice(0, 12)) {
    const meta = getActivityMeta(entry.action || '');
    items.push({
      id: `act-${entry.id}`,
      ts: entry.timestamp,
      label: meta.label,
      detail: entry.template ? `Template: ${entry.template}` : entry.leadName,
      tone: entry.status === 'error' ? 'error' : 'activity',
    });
  }

  items.sort((a, b) => {
    const ta = a.ts ? new Date(a.ts).getTime() : 0;
    const tb = b.ts ? new Date(b.ts).getTime() : 0;
    return tb - ta;
  });

  const shown = items.slice(0, 14);

  return (
    <section className="leads-detail-section">
      <h3 className="leads-detail-section__title">Communication timeline</h3>
      {shown.length === 0 ? (
        <p className="text-xs text-gs-muted">No communication history yet.</p>
      ) : (
        <ul className="leads-timeline">
          {shown.map(item => (
            <li key={item.id} className={`leads-timeline__item leads-timeline__item--${item.tone}`}>
              <div className="leads-timeline__dot" />
              <div className="leads-timeline__body">
                <p className="leads-timeline__label">{item.label}</p>
                {item.detail && <p className="leads-timeline__detail">{item.detail}</p>}
                {item.ts && (
                  <p className="leads-timeline__time">
                    {new Date(item.ts).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickActions({ lead, onClose, hasConversation, onArchive, archiving, isArchived }) {
  const navigate = useNavigate();

  const goReplies = () => {
    onClose();
    navigate('/replies', { state: { selectRowNumber: lead.row_number } });
  };

  return (
    <section className="leads-detail-section leads-detail-section--actions">
      <h3 className="leads-detail-section__title">Quick actions</h3>
      <div className="leads-quick-actions">
        <button
          type="button"
          className="leads-quick-actions__btn leads-quick-actions__btn--primary"
          onClick={() => { onClose(); navigate('/send', { state: { lead } }); }}
        >
          <Send size={14} /> Send template
        </button>
        {hasConversation && (
          <button type="button" className="leads-quick-actions__btn" onClick={goReplies}>
            <MessageSquare size={14} /> Open conversation
          </button>
        )}
        <button
          type="button"
          className="leads-quick-actions__btn"
          onClick={() => { onClose(); navigate('/send', { state: { lead, channel: 'sms' } }); }}
        >
          <Phone size={14} /> Send SMS
        </button>
        <button
          type="button"
          className="leads-quick-actions__btn"
          onClick={() => { onClose(); navigate('/send', { state: { lead, channel: 'email' } }); }}
        >
          <Mail size={14} /> Send email
        </button>
        {hasConversation && (
          <button type="button" className="leads-quick-actions__btn" onClick={goReplies}>
            <ExternalLink size={14} /> Reply history
          </button>
        )}
        <button
          type="button"
          className="leads-quick-actions__btn"
          onClick={onArchive}
          disabled={archiving}
        >
          {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          {isArchived ? 'Restore from archive' : 'Archive lead'}
        </button>
      </div>
    </section>
  );
}

export default function LeadDetailWorkspace({ lead, onClose, onLeadUpdated }) {
  const navigate = useNavigate();
  const { loading, loadError, activity, thread, insights, replyArchived } = useLeadDetailData(lead);
  const [archiving, setArchiving] = useState(false);

  const avatar = getAvatarStyle(lead.name);
  const hasConversation = thread.length > 0 || hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply);
  const sentDate = lead.sent && lead.sent !== 'imported' ? new Date(lead.sent) : null;

  async function handleArchive() {
    setArchiving(true);
    try {
      const isArchived = (lead.status || '').toLowerCase() === 'archived';
      await api.leads.update(lead.row_number, {
        ...lead,
        status: isArchived ? 'active' : 'archived',
      });
      onLeadUpdated?.();
    } catch {
      /* toast handled by parent if needed */
    } finally {
      setArchiving(false);
    }
  }

  return (
    <motion.aside
      className="leads-detail-panel"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      aria-label={`Lead details: ${lead.name}`}
    >
      <header className="leads-detail-panel__header">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: avatar.bg, color: avatar.text }}
        >
          {getInitials(lead.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-gs-text truncate">{lead.name || 'Unknown'}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
            <span className="text-gs-muted flex items-center gap-1"><Hash size={10} /> Row {lead.row_number}</span>
            {lead.status && <LeadStatusLabel value={lead.status} />}
            {lead.notes && <LeadStatusLabel value={lead.notes} />}
          </div>
        </div>
        <button type="button" onClick={onClose} className="leads-btn-icon shrink-0" aria-label="Close panel">
          <X size={18} />
        </button>
      </header>

      <div className="leads-detail-panel__scroll">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            {loadError && (
              <p className="text-xs text-gs-danger px-1 mb-4">{loadError}</p>
            )}

            <div className={`leads-health leads-health--${insights.health}`}>
              <div className="leads-health__main">
                <TrendingUp size={16} />
                <div>
                  <p className="leads-health__label">Lead health</p>
                  <p className="leads-health__value">{insights.healthLabel}</p>
                </div>
              </div>
              <div className="leads-health__score">
                <span className="leads-health__score-num">{insights.engagementScore}</span>
                <span className="leads-health__score-label">engagement</span>
              </div>
            </div>

            <div className="leads-insight-grid">
              <InsightTile label="Contact attempts" value={insights.contactAttempts} />
              <InsightTile label="Replies" value={insights.replyCount} />
              <InsightTile
                label="Last contact"
                value={insights.lastContact ? insights.lastContact.toLocaleDateString() : '—'}
                sub={insights.lastContact ? insights.lastContact.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null}
              />
              <InsightTile label="Workflow" value={insights.workflow} />
            </div>

            <section className="leads-detail-section">
              <h3 className="leads-detail-section__title">Customer overview</h3>
              <dl className="leads-overview-dl">
                <div><dt>Full name</dt><dd>{lead.name || '—'}</dd></div>
                <div><dt>Phone</dt><dd className="font-mono text-xs">{lead.phone || '—'}</dd></div>
                <div><dt>Email</dt><dd className="text-xs break-all">{lead.email || '—'}</dd></div>
                <div><dt>Status</dt><dd><LeadStatusLabel value={lead.status} /></dd></div>
                <div><dt>Lead source</dt><dd>{insights.leadSource}</dd></div>
                <div><dt>First sent</dt><dd>{sentDate ? sentDate.toLocaleDateString() : lead.sent === 'imported' ? 'Imported' : '—'}</dd></div>
                <div><dt>Last activity</dt><dd>{insights.lastContact ? insights.lastContact.toLocaleString() : '—'}</dd></div>
                <div><dt>Agreement sent</dt><dd>{insights.agreementSent ? 'Yes' : 'No'}</dd></div>
                <div><dt>Follow-up pending</dt><dd>{insights.followUpPending ? 'Yes' : 'No'}</dd></div>
                <div><dt>Archived</dt><dd>{insights.archived || replyArchived ? 'Yes' : 'No'}</dd></div>
              </dl>
            </section>

            {thread.length > 0 ? (
              <ConversationPreview thread={thread} leadName={lead.name} />
            ) : (
              <RecentResponses lead={lead} />
            )}

            <Timeline activity={activity} thread={thread} />

            {(lead.error || insights.stopped) && (
              <section className="leads-detail-section leads-detail-section--alert">
                {insights.stopped && (
                  <p className="text-xs text-gs-warn flex items-center gap-2"><AlertCircle size={14} /> Follow-ups stopped</p>
                )}
                {lead.error && (
                  <p className="text-xs text-gs-danger mt-2">{lead.error}</p>
                )}
              </section>
            )}

            <QuickActions
              lead={lead}
              onClose={onClose}
              hasConversation={hasConversation}
              onArchive={handleArchive}
              archiving={archiving}
              isArchived={(lead.status || '').toLowerCase() === 'archived'}
            />
          </>
        )}
      </div>

      <footer className="leads-detail-panel__footer">
        <button
          type="button"
          className="btn-primary text-xs flex-1 justify-center gap-1.5"
          onClick={() => { onClose(); navigate('/send', { state: { lead } }); }}
        >
          <Send size={12} /> Send template
        </button>
        {hasConversation && (
          <button type="button" className="btn-ghost text-xs gap-1.5" onClick={() => {
            onClose();
            navigate('/replies', { state: { selectRowNumber: lead.row_number } });
          }}>
            <MessageSquare size={12} /> Replies
          </button>
        )}
      </footer>
    </motion.aside>
  );
}
