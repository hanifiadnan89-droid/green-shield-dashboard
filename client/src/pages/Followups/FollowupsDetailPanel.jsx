import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  X, Phone, Mail, Send, MessageSquare, StopCircle, Calendar, Bot,
} from 'lucide-react';
import { getAvatarStyle, getInitials } from '../CRMPreview/mockData.js';
import LeadStatusLabel from '../Leads/LeadStatusLabel.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useLeadDetailData } from '../Leads/useLeadDetailData.js';
import { TEMPLATE_WORKFLOW_META } from '../SendTemplate/templateWorkflow.js';
import FollowupDaysLabel from './FollowupDaysLabel.jsx';
import FollowupStatusLabel from './FollowupStatusLabel.jsx';
import {
  daysSince,
  deriveDisplayStatus,
  getNextScheduledTouch,
  needsManualAction,
  templateCode,
} from './followupsUtils.js';

function SequenceTimeline({ lead, days }) {
  const code = templateCode(lead);
  const meta = TEMPLATE_WORKFLOW_META[code];
  const timeline = meta?.timeline || [
    { day: 0, title: 'Initial outreach', detail: 'SMS + Email' },
    { day: 2, title: 'Follow-up', detail: 'Reminder' },
    { day: 5, title: 'Final follow-up', detail: 'Closing touch' },
  ];

  return (
    <div className="followups-timeline">
      {timeline.map((step, i) => {
        const isPast = days !== null && step.day !== null && days >= step.day;
        const isCurrent = days !== null && step.day !== null && days >= step.day &&
          (timeline[i + 1]?.day == null || days < timeline[i + 1].day);
        return (
          <div
            key={`${step.day}-${step.title}`}
            className={`followups-timeline__item${!isPast ? ' followups-timeline__item--future' : ''}`}
          >
            <span className="followups-timeline__dot" style={isCurrent ? { background: '#16a34a', boxShadow: '0 0 0 3px rgba(22,163,74,0.25)' } : undefined} />
            <p className="text-sm font-semibold text-gs-text">{step.title}</p>
            <p className="text-xs text-gs-muted mt-0.5">
              {step.day != null ? `Day ${step.day}` : 'After sequence'} · {step.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function FollowupsDetailPanel({
  lead,
  onClose,
  onStop,
  onSendAgain,
  stopLoading,
}) {
  const navigate = useNavigate();
  const { loading, activity, thread, insights, loadError } = useLeadDetailData(lead);
  const days = daysSince(lead.sent);
  const next = getNextScheduledTouch(days);
  const status = deriveDisplayStatus(lead, days);
  const manual = needsManualAction(lead, days);
  const avatar = getAvatarStyle(lead.name);
  const busy = stopLoading[lead.row_number];

  const suggested =
    manual ? 'Review overdue sequence — consider Send Again or Stop'
      : status.key === 'in_flight' ? 'n8n is managing this sequence — monitor for reply'
        : 'No action required';

  return (
    <motion.aside
      className="followups-detail followups-detail--drawer"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="followups-detail__head">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: avatar.bg, color: avatar.text }}
          >
            {getInitials(lead.name)}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-gs-text truncate">{lead.name || 'Lead'}</h2>
            <FollowupStatusLabel lead={lead} days={days} />
          </div>
        </div>
        <button
          type="button"
          className="followups-btn followups-btn--ghost p-2"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="followups-detail__body">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <>
            {loadError && (
              <p className="text-xs text-gs-danger border border-gs-danger/20 rounded-lg px-3 py-2" style={{ background: 'rgba(220,38,38,0.08)' }}>
                {loadError}
              </p>
            )}

            <section>
              <h3 className="followups-detail-section__title">Customer</h3>
              <div className="space-y-2 text-sm">
                {lead.phone && (
                  <p className="flex items-center gap-2 text-gs-muted">
                    <Phone size={14} /> {lead.phone}
                  </p>
                )}
                {lead.email && (
                  <p className="flex items-center gap-2 text-gs-muted truncate">
                    <Mail size={14} /> {lead.email}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <span className="text-gs-muted">Template:</span>
                  <LeadStatusLabel value={lead.notes} />
                </p>
                <p className="flex items-center gap-2">
                  <Calendar size={14} className="text-gs-muted shrink-0" />
                  <span className="text-gs-muted">Sent</span>
                  <span className="font-medium text-gs-text">
                    {lead.sent && lead.sent !== 'imported'
                      ? new Date(lead.sent).toLocaleString()
                      : '—'}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gs-muted">Age:</span>
                  <FollowupDaysLabel days={days} />
                </p>
              </div>
            </section>

            <section>
              <h3 className="followups-detail-section__title">Automation</h3>
              <div className="rounded-xl border border-gs-info/20 bg-gs-info/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-gs-text">
                  <Bot size={14} className="text-gs-info" />
                  Managed by n8n
                </p>
                {next && (
                  <p className="text-gs-muted mt-2 text-xs leading-relaxed">
                    <strong className="text-gs-text">Next:</strong> {next.label}
                    {next.detail && <> — {next.detail}</>}
                  </p>
                )}
                <p className="text-xs text-gs-muted mt-2">
                  Stop rule: replies or stop=yes halts the sequence.
                </p>
              </div>
            </section>

            <section>
              <h3 className="followups-detail-section__title">Template sequence</h3>
              <SequenceTimeline lead={lead} days={days} />
            </section>

            {insights && (
              <section>
                <h3 className="followups-detail-section__title">Insights</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-gs-border/50 bg-white/60 px-3 py-2">
                    <p className="text-gs-muted">Health</p>
                    <p className="font-semibold text-gs-text mt-0.5">{insights.healthLabel}</p>
                  </div>
                  <div className="rounded-lg border border-gs-border/50 bg-white/60 px-3 py-2">
                    <p className="text-gs-muted">Workflow</p>
                    <p className="font-semibold text-gs-text mt-0.5 truncate">{insights.workflow}</p>
                  </div>
                  <div className="rounded-lg border border-gs-border/50 bg-white/60 px-3 py-2">
                    <p className="text-gs-muted">Touches</p>
                    <p className="font-semibold text-gs-text mt-0.5 tabular-nums">{insights.contactAttempts}</p>
                  </div>
                  <div className="rounded-lg border border-gs-border/50 bg-white/60 px-3 py-2">
                    <p className="text-gs-muted">Engagement</p>
                    <p className="font-semibold text-gs-text mt-0.5 tabular-nums">{insights.engagementScore}%</p>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="followups-detail-section__title">Suggested action</h3>
              <p className="text-sm text-gs-text font-medium">{suggested}</p>
            </section>

            {activity.length > 0 && (
              <section>
                <h3 className="followups-detail-section__title">Recent activity</h3>
                <ul className="space-y-2">
                  {activity.slice(0, 6).map(entry => (
                    <li key={entry.id} className="text-xs border-l-2 border-gs-accent/30 pl-3 py-0.5">
                      <span className="font-semibold text-gs-text">{entry.action}</span>
                      {entry.timestamp && (
                        <span className="text-gs-muted ml-2">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {thread.length > 0 && (
              <section>
                <h3 className="followups-detail-section__title">Messages</h3>
                <p className="text-xs text-gs-muted">{thread.length} in thread — open Replies for full view.</p>
              </section>
            )}
          </>
        )}
      </div>

      <div className="followups-detail__footer">
        <motion.button
          type="button"
          className="followups-btn followups-btn--send flex-1 justify-center py-2"
          onClick={() => onSendAgain(lead)}
          whileTap={{ scale: 0.98 }}
        >
          <Send size={14} />
          Send Again
        </motion.button>
        <motion.button
          type="button"
          className="followups-btn followups-btn--stop flex-1 justify-center py-2"
          onClick={() => onStop(lead)}
          disabled={busy}
          whileTap={{ scale: 0.98 }}
        >
          {busy ? <Spinner size={14} /> : <StopCircle size={14} />}
          Stop
        </motion.button>
        <motion.button
          type="button"
          className="followups-btn followups-btn--ghost w-full justify-center py-2"
          onClick={() => navigate('/replies', { state: { lead } })}
          whileTap={{ scale: 0.98 }}
        >
          <MessageSquare size={14} />
          Open conversation
        </motion.button>
      </div>
    </motion.aside>
  );
}
