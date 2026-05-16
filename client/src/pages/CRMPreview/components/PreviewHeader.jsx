import { RefreshCw } from 'lucide-react';

export default function PreviewHeader({ onRefresh, loading }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <header
      className="flex items-center gap-4 px-6 shrink-0"
      style={{
        height: '64px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
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
          className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer disabled:opacity-50"
          style={{
            background: 'transparent',
            border: '1px solid rgba(0,0,0,0.09)',
            borderRadius: '8px',
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
