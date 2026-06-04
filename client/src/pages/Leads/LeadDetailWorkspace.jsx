import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Phone, Mail, Send, MessageSquare, Archive, ArchiveRestore,
  AlertCircle, Edit3, HeartHandshake, StopCircle, PlayCircle,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { hasRealReply } from '../CRMPreview/mockData.js';
import { getAvatarStyle } from '../CRMPreview/mockData.js';
import { formatThreadTime } from '../Replies/threadUtils.js';
import { leadInitials } from './leadInitials.js';
import LeadFieldText from './LeadFieldText.jsx';
import { parseLeadName } from './parseLeadName.js';
import { buildLeadTimeline } from './buildLeadTimeline.js';
import { useLeadDetailData } from './useLeadDetailData.js';
import Spinner from '../../components/Spinner.jsx';

function DetailSection({ title, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`ldc-section ${className}`.trim()}>
      <h3 className="ldc-section__title">{title}</h3>
      <div className={`ldc-section__body ${bodyClassName}`.trim()}>{children}</div>
    </section>
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

function RecentMessages({ thread, leadName, smsFallback, emailFallback }) {
  const messages = [];

  if (thread?.length) {
    for (const msg of thread) {
      const isCustomer = msg.dir === 'in' || msg.direction === 'inbound';
      const body = (msg.text || msg.body || '').trim();
      if (!body) continue;
      messages.push({
        id: msg.id,
        isCustomer,
        channel: (msg.channel || 'sms').toLowerCase(),
        body,
        ts: msg.ts,
        who: isCustomer ? (leadName || 'Customer') : 'Office',
      });
    }
  }

  if (!messages.length) {
    if (smsFallback) {
      messages.push({
        id: 'sms-fb',
        isCustomer: true,
        channel: 'sms',
        body: smsFallback,
        ts: null,
        who: leadName || 'Customer',
      });
    }
    if (emailFallback) {
      messages.push({
        id: 'email-fb',
        isCustomer: true,
        channel: 'email',
        body: emailFallback,
        ts: null,
        who: leadName || 'Customer',
      });
    }
  }

  if (!messages.length) {
    return (
      <DetailSection title="Recent messages" className="ldc-section--primary" bodyClassName="ldc-section__body--scroll">
        <p className="ldc-empty-hint">No messages yet for this lead.</p>
      </DetailSection>
    );
  }

  const shown = messages.slice(-30);

  return (
    <DetailSection title="Recent messages" className="ldc-section--primary" bodyClassName="ldc-section__body--scroll">
      <div className="ldc-messages">
        {shown.map(msg => (
          <article
            key={msg.id}
            className={`ldc-message ${msg.isCustomer ? 'ldc-message--in' : 'ldc-message--out'}`}
          >
            <header className="ldc-message__head">
              <span className="ldc-message__who">{msg.who}</span>
              <span className="ldc-message__channel">{msg.channel}</span>
              {msg.ts && (
                <time className="ldc-message__time" dateTime={msg.ts}>
                  {formatThreadTime(msg.ts)}
                </time>
              )}
            </header>
            <p className="ldc-message__body">{msg.body}</p>
          </article>
        ))}
      </div>
    </DetailSection>
  );
}

function TimelineSection({ items }) {
  if (!items.length) {
    return (
      <DetailSection title="Timeline" className="ldc-section--timeline" bodyClassName="ldc-section__body--scroll">
        <p className="ldc-empty-hint">No timeline events yet.</p>
      </DetailSection>
    );
  }

  return (
    <DetailSection title="Timeline" className="ldc-section--timeline" bodyClassName="ldc-section__body--scroll">
      <ul className="ldc-timeline">
        {items.map(item => (
          <li key={item.id} className={`ldc-timeline__item ldc-timeline__item--${item.tone}`}>
            <span className="ldc-timeline__dot" aria-hidden />
            <div className="ldc-timeline__content">
              <p className="ldc-timeline__label">{item.label}</p>
              {item.detail && (
                <p className="ldc-timeline__detail">
                  {item.detail.length > 120 ? `${item.detail.slice(0, 120)}…` : item.detail}
                </p>
              )}
              {item.ts && (
                <p className="ldc-timeline__time">
                  {new Date(item.ts).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
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

function StickyActions({
  lead,
  onClose,
  onEdit,
  onMarkSold,
  onStop,
  onArchive,
  archiving,
  isArchived,
  isSold,
  isStopped,
  actionLoading,
  hasConversation,
}) {
  const navigate = useNavigate();
  const stopKey = `stop_${lead.row_number}`;
  const soldKey = `sold_${lead.row_number}`;

  return (
    <footer className="ldc-panel__actions">
      <div className="ldc-actions-grid">
        <button
          type="button"
          className="ldc-actions__btn ldc-actions__btn--primary"
          onClick={() => { onClose(); navigate('/send', { state: { lead } }); }}
        >
          <Send size={15} /> Send template
        </button>
        <button
          type="button"
          className="ldc-actions__btn"
          onClick={() => { onClose(); navigate('/send', { state: { lead, channel: 'sms' } }); }}
        >
          <Phone size={15} /> Send SMS
        </button>
        <button
          type="button"
          className="ldc-actions__btn"
          onClick={() => { onClose(); navigate('/send', { state: { lead, channel: 'email' } }); }}
        >
          <Mail size={15} /> Send email
        </button>
        <button type="button" className="ldc-actions__btn" onClick={() => onEdit(lead)}>
          <Edit3 size={15} /> Edit lead
        </button>
        <button
          type="button"
          className="ldc-actions__btn"
          onClick={() => !isSold && onMarkSold(lead)}
          disabled={isSold || actionLoading[soldKey]}
        >
          {actionLoading[soldKey] ? <Spinner size={14} /> : <HeartHandshake size={15} />}
          Mark sold
        </button>
        <button
          type="button"
          className="ldc-actions__btn ldc-actions__btn--danger"
          onClick={() => onStop(lead)}
          disabled={actionLoading[stopKey]}
        >
          {actionLoading[stopKey]
            ? <Spinner size={14} />
            : isStopped ? <PlayCircle size={15} /> : <StopCircle size={15} />}
          {isStopped ? 'Resume lead' : 'Stop lead'}
        </button>
        {hasConversation && (
          <button
            type="button"
            className="ldc-actions__btn ldc-actions__btn--span"
            onClick={() => {
              onClose();
              navigate('/replies', { state: { selectRowNumber: lead.row_number } });
            }}
          >
            <MessageSquare size={15} /> Open full conversation
          </button>
        )}
        <button
          type="button"
          className="ldc-actions__btn"
          onClick={onArchive}
          disabled={archiving}
        >
          {isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          {isArchived ? 'Restore' : 'Archive'}
        </button>
      </div>
    </footer>
  );
}

export default function LeadDetailWorkspace({
  lead,
  onClose,
  onLeadUpdated,
  onEdit,
  onMarkSold,
  onStop,
  actionLoading = {},
}) {
  const { loading, loadError, activity, thread, insights, replyArchived } = useLeadDetailData(lead);
  const [archiving, setArchiving] = useState(false);

  const { displayName, accountNumber } = parseLeadName(lead.name);
  const avatar = getAvatarStyle(displayName || lead.name);
  const hasConversation = thread.length > 0 || hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply);
  const sentDate = lead.sent && lead.sent !== 'imported' ? new Date(lead.sent) : null;
  const isArchived = (lead.status || '').toLowerCase() === 'archived';
  const isSold = (lead.sold || '').toLowerCase() === 'yes';
  const isStopped = lead.stop === 'yes';

  const timelineItems = buildLeadTimeline(lead, activity, thread, {
    ...insights,
    archived: insights.archived || replyArchived,
  });

  const smsFallback = hasRealReply(lead.sms_reply) ? lead.sms_reply.trim() : '';
  const emailFallback = hasRealReply(lead.email_reply) ? lead.email_reply.trim() : '';

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
    <aside className="lead-workspace ldc-panel h-full">
      <header className="ldc-panel__header">
        <div className="ldc-panel__identity">
          <span
            className="ldc-panel__avatar ldc-panel__avatar--lg"
            style={{ background: avatar.bg, color: avatar.text }}
            aria-hidden
          >
            {leadInitials(displayName || lead.name)}
          </span>
          <div className="ldc-panel__title-block">
            <h2 className="ldc-panel__name">{displayName || 'Unknown'}</h2>
            {accountNumber && (
              <p className="ldc-panel__account">
                Account <span className="ldc-panel__account-num">{accountNumber}</span>
              </p>
            )}
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
        <button type="button" onClick={onClose} className="leads-btn-icon" aria-label="Close workspace">
          <X size={18} />
        </button>
      </header>

      <div className="ldc-panel__frame">
        <div className="ldc-panel__scroll">
          {loading ? (
            <div className="ldc-panel__loading"><Spinner /></div>
          ) : (
            <>
              {loadError && <p className="ldc-panel__error">{loadError}</p>}

              <div className="ldc-summary-row">
                <div className="ldc-engagement ldc-engagement--compact">
                  <div>
                    <p className="ldc-engagement__label">Engagement</p>
                    <p className="ldc-engagement__status">{insights.healthLabel}</p>
                  </div>
                  <div className="ldc-engagement__score">
                    <span className="ldc-engagement__num">{insights.engagementScore}</span>
                    <span className="ldc-engagement__unit">score</span>
                  </div>
                </div>

                <div className="ldc-activity-strip">
                  <div className="ldc-activity-strip__item">
                    <span className="ldc-activity-strip__label">Last contact</span>
                    <span className="ldc-activity-strip__value">{formatDateTime(insights.lastContact)}</span>
                  </div>
                  <div className="ldc-activity-strip__item">
                    <span className="ldc-activity-strip__label">Replies</span>
                    <span className="ldc-activity-strip__value">{insights.replyCount}</span>
                  </div>
                  <div className="ldc-activity-strip__item">
                    <span className="ldc-activity-strip__label">Attempts</span>
                    <span className="ldc-activity-strip__value">{insights.contactAttempts}</span>
                  </div>
                </div>
              </div>

              <RecentMessages
                thread={thread}
                leadName={displayName}
                smsFallback={smsFallback}
                emailFallback={emailFallback}
              />

              <TimelineSection items={timelineItems} />

              <div className="ldc-overview-grid">
                <DetailSection title="Lead overview">
                  <dl className="ldc-dl ldc-dl--compact">
                    <div className="ldc-row">
                      <dt className="ldc-row__label">Name</dt>
                      <dd className="ldc-row__value">{displayName || '—'}</dd>
                    </div>
                    {accountNumber && (
                      <div className="ldc-row">
                        <dt className="ldc-row__label">Account</dt>
                        <dd className="ldc-row__value ldc-mono">{accountNumber}</dd>
                      </div>
                    )}
                    <div className="ldc-row">
                      <dt className="ldc-row__label">Status</dt>
                      <dd className="ldc-row__value">
                        <LeadFieldText value={lead.status} kind="status" />
                      </dd>
                    </div>
                    <div className="ldc-row">
                      <dt className="ldc-row__label">Source</dt>
                      <dd className="ldc-row__value">{insights.leadSource}</dd>
                    </div>
                    <div className="ldc-row">
                      <dt className="ldc-row__label">Row</dt>
                      <dd className="ldc-row__value">#{lead.row_number}</dd>
                    </div>
                    <div className="ldc-row">
                      <dt className="ldc-row__label">First sent</dt>
                      <dd className="ldc-row__value">
                        {sentDate ? formatDateOnly(sentDate) : lead.sent === 'imported' ? 'imported' : '—'}
                      </dd>
                    </div>
                    <div className="ldc-row">
                      <dt className="ldc-row__label">Agreement</dt>
                      <dd className="ldc-row__value">{insights.agreementSent ? 'yes' : 'no'}</dd>
                    </div>
                  </dl>
                </DetailSection>
              </div>

              {(lead.error || insights.stopped) && (
                <div className="ldc-alert">
                  {insights.stopped && (
                    <p><AlertCircle size={14} /> Follow-ups stopped</p>
                  )}
                  {lead.error && <p>{lead.error}</p>}
                </div>
              )}
            </>
          )}
        </div>

        {!loading && (
          <StickyActions
            lead={lead}
            onClose={onClose}
            onEdit={onEdit}
            onMarkSold={onMarkSold}
            onStop={onStop}
            onArchive={handleArchive}
            archiving={archiving}
            isArchived={isArchived}
            isSold={isSold}
            isStopped={isStopped}
            actionLoading={actionLoading}
            hasConversation={hasConversation}
          />
        )}
      </div>
    </aside>
  );
}
