import { RefreshCw } from 'lucide-react';

export default function PreviewHeader({ onRefresh, loading }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <header
      className="premium-header flex items-center gap-4 px-6 shrink-0"
      style={{
        height: '64px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Left: title + date */}
      <div>
        <p className="font-heading font-bold text-[#0F172A] text-sm leading-tight">Dashboard</p>
        <p className="text-[11px] text-[#94A3B8]">{today}</p>
      </div>

      {/* Right: refresh */}
      <div className="ml-auto shrink-0">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="icon-button flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] disabled:opacity-50"
          style={{
            padding: '6px 10px',
          }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </header>
  );
}
