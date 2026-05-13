import { Bug, Calendar, ChevronRight, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

const SERVICE_ICONS = {
  general:  '🪲',
  rodent:   '🐭',
  termite:  '🪵',
  mosquito: '🦟',
  wasp:     '🐝',
  bed_bug:  '🛏️',
};

export default function ServiceStatusCard({
  customerName,
  serviceType = 'general',
  serviceLabel,
  status,
  lastContact,
  nextAction,
  onAction,
  actionLabel = 'Send Follow-up',
  actionVariant = 'primary',
}) {
  const emoji = SERVICE_ICONS[serviceType] ?? '🛡️';
  const label = serviceLabel ?? (serviceType.charAt(0).toUpperCase() + serviceType.slice(1).replace('_', ' ')) + ' Service';

  const actionClass =
    actionVariant === 'danger'
      ? 'btn text-xs px-3 py-1.5 bg-gs-danger/15 border border-gs-danger/30 text-gs-danger hover:bg-gs-danger/25'
      : actionVariant === 'ghost'
      ? 'btn-ghost text-xs px-3 py-1.5'
      : 'btn text-xs px-3 py-1.5 bg-gs-accent/15 border border-gs-accent/30 text-gs-accent hover:bg-gs-accent/25';

  return (
    <div className="card flex flex-col gap-3">

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0 select-none">{emoji}</span>
          <div className="min-w-0">
            <p className="text-gs-text font-semibold text-sm truncate leading-snug">{customerName}</p>
            <p className="text-gs-muted text-xs truncate mt-0.5">{label}</p>
          </div>
        </div>
        <StatusBadge value={status} />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-gs-muted border-t border-gs-border pt-3">
        {lastContact && (
          <span className="flex items-center gap-1 shrink-0">
            <Clock size={11} />
            {lastContact}
          </span>
        )}
        {nextAction && (
          <span className="flex items-center gap-1 truncate">
            <Calendar size={11} className="shrink-0" />
            <span className="truncate">{nextAction}</span>
          </span>
        )}
      </div>

      {/* Action button */}
      <button
        onClick={onAction}
        className={`w-full flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors ${actionClass}`}
      >
        {actionLabel}
        <ChevronRight size={12} />
      </button>

    </div>
  );
}
