import { RefreshCw, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

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

      {/* Right: refresh + CTA */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
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

        <Link
          to="/send"
          className="flex items-center gap-1.5 text-xs font-semibold text-white no-underline"
          style={{
            background: '#16A34A',
            borderRadius: '8px',
            padding: '7px 14px',
            transition: 'background-color 0.15s, box-shadow 0.15s, transform 0.1s',
            boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(22,163,74,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#16A34A'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,163,74,0.25)'; }}
        >
          <Send size={12} />
          Send Template
        </Link>
      </div>
    </header>
  );
}
