import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  FileCheck,
  Flame,
  MessageSquare,
  Percent,
  Send,
  Star,
  Users,
} from 'lucide-react';
import AnimatedNumber from '../../../components/AnimatedNumber.jsx';
import { deriveDashboardIntelligence } from '../intelligence/deriveDashboardIntelligence.js';
import { getAvatarStyle, getInitials, TEMPLATE_META } from '../mockData.js';

function TemplateBadge({ notes }) {
  const key = (notes || '').toLowerCase();
  const meta = key === 't/m' ? TEMPLATE_META.tm : TEMPLATE_META[key];
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center type-label-sm uppercase px-1.5 py-0.5 rounded shrink-0"
      style={{ background: meta.bg, color: meta.textColor }}
    >
      {meta.label}
    </span>
  );
}

function formatPercent(value) {
  if (value == null) return '—';
  return `${value}%`;
}

const STRIP_METRICS = [
  { key: 'actionToday', label: 'Action Today', icon: AlertTriangle, accent: '#DC2626' },
  { key: 'agreementsPending', label: 'AG Pending', icon: FileCheck, accent: '#2563EB' },
  { key: 'overdueFollowUps', label: 'Overdue', icon: Clock, accent: '#D97706' },
  { key: 'sentToReplyPercent', label: 'Sent → Reply', icon: Percent, accent: '#16A34A', isPercent: true },
  { key: 'soldRatePercent', label: 'Sold Rate', icon: Star, accent: '#9333EA', isPercent: true },
];

const QUICK_ACTIONS = [
  { id: 'replies', label: 'Replies', icon: MessageSquare, href: '/replies', tone: '#16A34A' },
  { id: 'followups', label: 'Follow-ups', icon: Clock, href: '/followups', tone: '#D97706' },
  { id: 'ag', label: 'AG Leads', icon: FileCheck, href: '/leads?notes=ag', tone: '#2563EB' },
  { id: 'errors', label: 'Errors', icon: AlertTriangle, filter: 'errors', tone: '#DC2626' },
];

function HotLeadRow({ item, onNavigateSend }) {
  const { lead, reason, days } = item;
  const avatar = getAvatarStyle(lead.name || '');
  const initials = getInitials(lead.name || '');

  return (
    <div className="di-hot-row">
      <div
        className="di-hot-row__avatar font-display font-bold"
        style={{ background: avatar.bg, color: avatar.text }}
      >
        {initials}
      </div>
      <div className="di-hot-row__body min-w-0">
        <div className="flex items-center gap-2">
          <p className="type-body-sm font-semibold text-gs-text truncate">{lead.name || '—'}</p>
          <TemplateBadge notes={lead.notes} />
        </div>
        <p className="type-label-sm text-gs-muted truncate normal-case tracking-normal">{reason}</p>
      </div>
      <div className="di-hot-row__meta shrink-0 flex items-center gap-2">
        {days != null && (
          <span className="type-label-sm text-gs-muted tabular-nums">{days}d</span>
        )}
        <button
          type="button"
          className="di-hot-row__send"
          title="Send template"
          onClick={() => onNavigateSend(lead)}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

function DashboardIntelligence({
  leads = [],
  loading = false,
  isUnreadReply,
  onFilterChange,
}) {
  const navigate = useNavigate();

  const intel = useMemo(
    () => (loading ? null : deriveDashboardIntelligence(leads, { isUnreadReply })),
    [leads, loading, isUnreadReply],
  );

  const handleQuickAction = (action) => {
    if (action.filter) {
      onFilterChange?.(action.filter);
      return;
    }
    if (action.href) navigate(action.href);
  };

  const handleSend = (lead) => {
    navigate('/send', { state: { lead } });
  };

  return (
    <section className="di-root bento-card section-enter p-4 lg:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-gs-accent" />
            <h3 className="type-display-lg font-extrabold text-gs-text">Dashboard Intelligence</h3>
          </div>
          <p className="type-body-sm text-gs-muted mt-0.5">
            Priorities from your current lead snapshot
          </p>
        </div>
        {intel && (
          <p className="type-label-sm text-gs-muted tabular-nums">
            <Users size={12} className="inline mr-1 opacity-60" />
            {intel.sentCount} contacted · {intel.soldCount} sold
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STRIP_METRICS.map(({ key, label, icon: Icon, accent, isPercent }, i) => {
          const raw = intel?.[key];
          const display = isPercent ? formatPercent(raw) : (raw ?? 0);
          const hasValue = isPercent ? raw != null && raw > 0 : (raw ?? 0) > 0;

          return (
            <div
              key={key}
              className="di-metric"
              style={{
                animationDelay: `${i * 40}ms`,
                borderColor: hasValue ? `${accent}22` : undefined,
              }}
            >
              <Icon size={14} style={{ color: accent }} />
              {loading ? (
                <div className="skeleton h-7 w-12 rounded mt-1" />
              ) : (
                <p className="type-display-lg text-gs-text leading-none mt-1 tabular-nums">
                  {isPercent ? (
                    display
                  ) : (
                    <AnimatedNumber value={typeof raw === 'number' ? raw : 0} />
                  )}
                </p>
              )}
              <p className="type-label-sm uppercase text-gs-muted mt-1 leading-tight">{label}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ id, label, icon: Icon, tone }) => (
          <button
            key={id}
            type="button"
            className="di-action-btn"
            style={{ '--di-tone': tone }}
            onClick={() => handleQuickAction(QUICK_ACTIONS.find((a) => a.id === id))}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="di-hot-panel">
        <p className="type-label-md uppercase text-gs-muted mb-3">Hot leads</p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : intel?.hotLeads?.length ? (
          <div className="space-y-2">
            {intel.hotLeads.map((item) => (
              <HotLeadRow
                key={item.lead.row_number}
                item={item}
                onNavigateSend={handleSend}
              />
            ))}
          </div>
        ) : (
          <p className="type-body-sm text-gs-muted py-4 text-center">
            No urgent leads right now — pipeline looks clear.
          </p>
        )}
      </div>
    </section>
  );
}

export default memo(DashboardIntelligence);
