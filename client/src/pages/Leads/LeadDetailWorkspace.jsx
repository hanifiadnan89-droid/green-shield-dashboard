import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  X, Phone, Mail, Send, MessageSquare, Archive, ArchiveRestore,
  ExternalLink, AlertCircle,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { hasRealReply } from '../CRMPreview/mockData.js';
import { getAvatarStyle, getInitials } from '../CRMPreview/mockData.js';
import { getActivityMeta } from '../CRMPreview/mockData.js';
import { formatThreadTime } from '../Replies/threadUtils.js';
import LeadFieldText, { formatNoteLabel } from './LeadFieldText.jsx';
import { useLeadDetailData } from './useLeadDetailData.js';
import Spinner from '../../components/Spinner.jsx';

function DetailSection({ title, children, className = '' }) {
  return (
    <section className={`ldc-section ${className}`.trim()}>
      <h3 className="ldc-section__title">{title}</h3>
      <div className="ldc-section__body">{children}</div>
    </section>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="ldc-row">
      <dt className="ldc-row__label">{label}</dt>
      <dd className="ldc-row__value">{children}</dd>
    </div>
  );
}

function formatDateTime(d) {
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(d) {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ConversationPreview({ thread, leadName }) {
  const recent = thread.slice(-5);
  if (!recent.length) return null;

  return (
    <DetailSection title="Recent messages">
      <div className="ldc-thread">
        {recent.map(msg => {
          const isCustomer = msg.dir === 'in' || msg.direction === 'inbound';
          return (
            <div
              key={msg.id}
              className={`ldc-thread__bubble ${isCustomer ? 'ldc-thread__bubble--in' : 'ldc-thread__bubble--out'}`}
            >
              <p className="ldc-thread__who">{isCustomer ? (leadName || 'Customer') : 'Office'}</p>
              <p className="ldc-thread__text">{msg.text}</p>
              {msg.ts && <p className="ldc-thread__time">{formatThreadTime(msg.ts)}</p>}
            </div>
          );
        })}
      </div>
    </DetailSection>
  );
}

function RecentResponses({ lead }) {
  const sms = hasRealReply(lead.sms_reply) ? lead.sms_reply.trim() : '';
  const email = hasRealReply(lead.email_reply) ? lead.email_reply.trim() : '';
  if (!sms && !email) return null;

  return (
    <DetailSection title="Recent responses">
      <div className="ldc-responses">
        {sms && (
          <blockquote className="ldc-responses__item">
            <span className="ldc-responses__channel"><MessageSquare size={11} /> SMS</span>
            <p>{sms}</p>
          </blockquote>
        )}
        {email && (
          <blockquote className="ldc-responses__item">
            <span className="ldc-responses__channel"><Mail size={11} /> Email</span>
            <p>{email.length > 320 ? `${email.slice(0, 320)}…` : email}</p>
          </blockquote>
        )}
      </div>
    </DetailSection>
  );
}

function Timeline({ activity, thread }) {
  const items = [];

  for (const msg of [...thread].reverse().slice(0, 6)) {
    const isIn = msg.dir === 'in' || msg.direction === 'inbound';
    items.push({
      id: `msg-${msg.id}`,
      ts: msg.ts,
      label: isIn ? 'Customer replied' : msg.isTemplate ? 'Template sent' : 'Message sent',
      detail: msg.text?.length > 72 ? `${msg.text.slice(0, 72)}…` : msg.text,
      tone: isIn ? 'in' : 'out',
    });
  }

  for (const entry of activity.slice(0, 8)) {
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

  const shown = items.slice(0, 10);
  if (!shown.length) return null;

  return (
    <DetailSection title="Timeline">
      <ul className="ldc-timeline">
        {shown.map(item => (
          <li key={item.id} className={`ldc-timeline__item ldc-timeline__item--${item.tone}`}>
            <span className="ldc-timeline__dot" aria-hidden />
            <div>
              <p className="ldc-timeline__label">{item.label}</p>
              {item.detail && <p className="ldc-timeline__detail">{item.detail}</p>}
              {item.ts && (
                <p className="ldc-timeline__time">
                  {new Date(item.ts).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

function QuickActions({ lead, onClose, hasConversation, onArchive, archiving, isArchived }) {
  const navigate = useNavigate();

  return (
    <DetailSection title="Actions" className="ldc-section--actions">
      <div className="ldc-actions">
        <button
          type="button"
          className="ldc-actions__btn ldc-actions__btn--primary"
          onClick={() => { onClose(); navigate('/send', { state: { lead } }); }}
        >
          <Send size={14} /> Send template
        </button>
        {hasConversation && (
          <button
            type="button"
            className="ldc-actions__btn"
            onClick={() => { onClose(); navigate('/replies', { state: { selectRowNumber: lead.row_number } }); }}
          >
            <MessageSquare size={14} /> Open conversation
          </button>
        )}
        <button
          type="button"
          className="ldc-actions__btn"
          onClick={() => { onClose(); navigate('/send', { state: { lead, channel: 'sms' } }); }}
        >
          <Phone size={14} /> SMS
        </button>
        <button
          type="button"
          className="ldc-actions__btn"
          onClick={() => { onClose(); navigate('/send', { state: { lead, channel: 'email' } }); }}
        >
          <Mail size={14} /> Email
        </button>
        {hasConversation && (
          <button
            type="button"
            className="ldc-actions__btn"
            onClick={() => { onClose(); navigate('/replies', { state: { selectRowNumber: lead.row_number } }); }}
          >
            <ExternalLink size={14} /> Reply history
          </button>
        )}
        <button
          type="button"
          className="ldc-actions__btn"
          onClick={onArchive}
          disabled={archiving}
        >
          {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          {isArchived ? 'Restore' : 'Archive'}
        </button>
      </div>
    </DetailSection>
  );
}

export default function LeadDetailWorkspace({ lead, onClose, onLeadUpdated }) {
  const navigate = useNavigate();
  const { loading, loadError, activity, thread, insights, replyArchived } = useLeadDetailData(lead);
  const [archiving, setArchiving] = useState(false);

  const avatar = getAvatarStyle(lead.name);
  const hasConversation = thread.length > 0 || hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply);
  const sentDate = lead.sent && lead.sent !== 'imported' ? new Date(lead.sent) : null;
  const isArchived = (lead.status || '').toLowerCase() === 'archived';
  const isSold = (lead.sold || '').toLowerCase() === 'yes';
  const noteKey = formatNoteLabel(lead.notes);
  const followUpLabel = insights.followUpPending
    ? 'Due'
    : insights.stopped
      ? 'Stopped'
      : insights.hasReply
        ? 'Engaged'
        : sentDate
          ? 'In sequence'
          : 'Not started';

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.leads.update(lead.row_number, {
        ...lead,
        status: isArchived ? 'active' : 'archived',
      });
      onLeadUpdated?.();
    } catch {
      /* parent may toast */
    } finally {
      setArchiving(false);
    }
  }

  return (
    <motion.aside
      className="leads-detail-panel ldc-panel"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      aria-label={`Lead details: ${lead.name}`}
    >
      <header className="ldc-panel__header">
        <div className="ldc-panel__identity">
          <span
            className="ldc-panel__avatar"
            style={{ background: avatar.bg, color: avatar.text }}
            aria-hidden
          >
            {getInitials(lead.name)}
          </span>
          <div className="ldc-panel__title-block">
            <h2 className="ldc-panel__name">{lead.name || 'Unknown'}</h2>
            <p className="ldc-panel__meta">
              <LeadFieldText value={lead.status} kind="status" />
              {lead.notes && (
                <>
                  <span className="ldc-panel__meta-sep">·</span>
                  <LeadFieldText value={lead.notes} kind="note" />
                </>
              )}
              {isSold && (
                <>
                  <span className="ldc-panel__meta-sep">·</span>
                  <span className="lc-field lc-field--accent">sold</span>
                </>
              )}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="leads-btn-icon" aria-label="Close panel">
          <X size={18} />
        </button>
      </header>

      <div className="ldc-panel__scroll">
        {loading ? (
          <div className="ldc-panel__loading"><Spinner /></div>
        ) : (
          <>
            {loadError && <p className="ldc-panel__error">{loadError}</p>}

            <div className="ldc-engagement">
              <div>
                <p className="ldc-engagement__label">Engagement</p>
                <p className="ldc-engagement__status">{insights.healthLabel}</p>
              </div>
              <div className="ldc-engagement__score">
                <span className="ldc-engagement__num">{insights.engagementScore}</span>
                <span className="ldc-engagement__unit">score</span>
              </div>
            </div>

            <DetailSection title="Lead overview">
              <dl className="ldc-dl">
                <DetailRow label="Name">{lead.name || '—'}</DetailRow>
                <DetailRow label="Status">
                  <LeadFieldText value={lead.status} kind="status" />
                </DetailRow>
                <DetailRow label="Source">{insights.leadSource}</DetailRow>
                <DetailRow label="Row">#{lead.row_number}</DetailRow>
              </dl>
            </DetailSection>

            <DetailSection title="Activity summary">
              <dl className="ldc-dl">
                <DetailRow label="Last contact">{formatDateTime(insights.lastContact)}</DetailRow>
                <DetailRow label="Replies">{insights.replyCount}</DetailRow>
                <DetailRow label="Contact attempts">{insights.contactAttempts}</DetailRow>
                <DetailRow label="Engagement">{insights.healthLabel}</DetailRow>
              </dl>
            </DetailSection>

            <DetailSection title="Communication">
              <dl className="ldc-dl">
                <DetailRow label="Phone">
                  <span className="ldc-mono">{lead.phone || '—'}</span>
                </DetailRow>
                <DetailRow label="Email">
                  <span className="ldc-break">{lead.email || '—'}</span>
                </DetailRow>
                <DetailRow label="First sent">
                  {sentDate ? formatDateOnly(sentDate) : lead.sent === 'imported' ? 'imported' : '—'}
                </DetailRow>
                <DetailRow label="Agreement sent">{insights.agreementSent ? 'yes' : 'no'}</DetailRow>
              </dl>
            </DetailSection>

            <DetailSection title="Workflow">
              <dl className="ldc-dl">
                <DetailRow label="Current workflow">
                  <LeadFieldText value={lead.notes} kind="note" />
                </DetailRow>
                <DetailRow label="Template stage">{noteKey}</DetailRow>
                <DetailRow label="Follow-up">{followUpLabel.toLowerCase()}</DetailRow>
                <DetailRow label="Archived">
                  {insights.archived || replyArchived ? 'yes' : 'no'}
                </DetailRow>
              </dl>
            </DetailSection>

            {thread.length > 0 ? (
              <ConversationPreview thread={thread} leadName={lead.name} />
            ) : (
              <RecentResponses lead={lead} />
            )}

            <Timeline activity={activity} thread={thread} />

            {(lead.error || insights.stopped) && (
              <div className="ldc-alert">
                {insights.stopped && (
                  <p><AlertCircle size={14} /> Follow-ups stopped</p>
                )}
                {lead.error && <p>{lead.error}</p>}
              </div>
            )}

            <QuickActions
              lead={lead}
              onClose={onClose}
              hasConversation={hasConversation}
              onArchive={handleArchive}
              archiving={archiving}
              isArchived={isArchived}
            />
          </>
        )}
      </div>

      <footer className="ldc-panel__footer">
        <button
          type="button"
          className="ldc-actions__btn ldc-actions__btn--primary flex-1 justify-center"
          onClick={() => { onClose(); navigate('/send', { state: { lead } }); }}
        >
          <Send size={12} /> Send template
        </button>
        {hasConversation && (
          <button
            type="button"
            className="ldc-actions__btn"
            onClick={() => {
              onClose();
              navigate('/replies', { state: { selectRowNumber: lead.row_number } });
            }}
          >
            <MessageSquare size={12} /> Replies
          </button>
        )}
      </footer>
    </motion.aside>
  );
}
