// ---------------------------------------------------------------------------
// Status badge for each date pill — extracted from RouteFinderWidget.jsx
// ---------------------------------------------------------------------------
import { Loader2, RefreshCw } from 'lucide-react';

const STATUS_CFG = {
  cached:         { label: 'Cached',  color: '#16A34A' },
  refreshing:     { label: 'Loading', color: '#3B82F6', spinning: true },
  failed:         { label: 'Failed',  color: '#DC2626', showRefresh: true },
  needs_login:    { label: 'Login',   color: '#F59E0B', showRefresh: true },
  missing:        { label: '—',       color: '#94A3B8', showRefresh: true },
  not_configured: { label: '—',       color: '#CBD5E1' },
};

function fmtAgo(isoStr) {
  if (!isoStr) return null;
  const ageMin = Math.round((Date.now() - new Date(isoStr).getTime()) / 60000);
  if (ageMin < 1)    return 'just now';
  if (ageMin < 60)   return `${ageMin}m ago`;
  if (ageMin < 1440) return `${Math.floor(ageMin / 60)}h ago`;
  return `${Math.floor(ageMin / 1440)}d ago`;
}

function StatusBadge({ status, meta, date, onRefresh }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.missing;
  const ago = status === 'cached' ? fmtAgo(meta?.timestamp) : null;
  return (
    <div className="mt-0.5 flex items-center justify-center gap-0.5 min-h-3.5">
      {cfg.spinning
        ? <Loader2 size={9} className="animate-spin" style={{ color: cfg.color }} />
        : <span className="text-[9px] font-semibold" style={{ color: cfg.color }}>{cfg.label}{ago ? ` · ${ago}` : ''}</span>
      }
      {cfg.showRefresh && onRefresh && (
        <button
          type="button"
          onClick={() => onRefresh(date)}
          className="bg-transparent border-0 cursor-pointer p-0 flex text-slate-400 leading-none"
          title="Refresh"
        >
          <RefreshCw size={9} />
        </button>
      )}
    </div>
  );
}

export default StatusBadge;
