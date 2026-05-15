import { Link, useLocation } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Send, Workflow, Clock, Activity,
  MessageSquare, AlertCircle, StopCircle, ChevronRight, ArrowLeft
} from 'lucide-react';

const NAV = [
  {
    group: 'OVERVIEW',
    items: [
      { to: '/crm-preview', icon: LayoutDashboard, label: 'Dashboard', internal: true },
    ],
  },
  {
    group: 'LEADS',
    items: [
      { to: '/leads',                     icon: Users,         label: 'All Leads' },
      { to: '/leads?category=replies',    icon: MessageSquare, label: 'Replies',     badge: 'replied' },
      { to: '/leads?category=errors',     icon: AlertCircle,   label: 'Errors',      badge: 'errors', urgent: true },
      { to: '/leads?category=stopped',    icon: StopCircle,    label: 'Stopped',     badge: 'stopped' },
      { to: '/leads?category=inprogress', icon: Clock,         label: 'In Progress', badge: 'inProgress' },
    ],
  },
  {
    group: 'TOOLS',
    items: [
      { to: '/send',       icon: Send,     label: 'Send Template' },
      { to: '/workflows',  icon: Workflow, label: 'Workflows' },
      { to: '/followups',  icon: Clock,    label: 'Follow-ups' },
      { to: '/activity',   icon: Activity, label: 'Activity Log' },
    ],
  },
];

export default function PremiumSidebar({ stats, testMode }) {
  const location = useLocation();
  const isDashboard = location.pathname === '/crm-preview';

  function getBadgeCount(key) {
    if (!stats || !key) return 0;
    if (key === 'replied') return (stats.smsReplies ?? 0) + (stats.emailReplies ?? 0);
    return stats[key] ?? 0;
  }

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: '256px',
        background: 'linear-gradient(180deg, #0d1f0f 0%, #0a1a0c 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo */}
      <div
        className="px-5 py-5 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div style={{ background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(22,163,74,0.28)', borderRadius: '10px', padding: '8px', display: 'inline-flex' }}>
          <Shield size={18} style={{ color: '#4ade80' }} />
        </div>
        <div>
          <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px', lineHeight: 1.2, fontFamily: 'Poppins, Inter, system-ui' }}>Green Shield</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', lineHeight: 1.4 }}>Pest Solutions CRM</p>
        </div>
      </div>

      {/* Preview badge */}
      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div
          style={{
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.22)',
            borderRadius: '8px',
            padding: '5px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
          <span style={{ color: '#c4b5fd', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Preview Mode
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV.map(({ group, items }) => (
          <div key={group} className="mb-5">
            <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 8px', marginBottom: '4px' }}>
              {group}
            </p>
            {items.map(({ to, icon: Icon, label, badge, urgent, internal }) => {
              const isActive = internal && isDashboard;
              const count = badge ? getBadgeCount(badge) : 0;

              return (
                <Link
                  key={to}
                  to={to}
                  className="sidebar-item flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl mb-0.5 no-underline"
                  style={{
                    background: isActive ? 'rgba(22,163,74,0.12)' : 'transparent',
                    borderLeft: isActive ? '2px solid #16A34A' : '2px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={15} style={{ color: isActive ? '#4ade80' : 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
                    <span style={{ color: isActive ? '#e2e8f0' : 'rgba(255,255,255,0.50)', fontSize: '13px', fontWeight: isActive ? 600 : 400 }}>
                      {label}
                    </span>
                  </div>
                  {count > 0 ? (
                    <span style={{
                      background: urgent && count > 0 ? '#DC2626' : 'rgba(22,163,74,0.25)',
                      color: urgent && count > 0 ? '#ffffff' : '#4ade80',
                      fontSize: '10px', fontWeight: 700,
                      padding: '1px 6px', borderRadius: '999px', minWidth: '18px', textAlign: 'center',
                    }}>
                      {count}
                    </span>
                  ) : (
                    !internal && <ChevronRight size={11} style={{ color: 'rgba(255,255,255,0.18)' }} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Mode badge */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
          style={{
            background: testMode ? 'rgba(217,119,6,0.10)' : 'rgba(22,163,74,0.10)',
            border: `1px solid ${testMode ? 'rgba(217,119,6,0.18)' : 'rgba(22,163,74,0.18)'}`,
          }}
        >
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: testMode ? '#F59E0B' : '#22c55e',
            display: 'inline-block', flexShrink: 0,
            boxShadow: testMode ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(34,197,94,0.5)',
          }} />
          <span style={{ color: testMode ? '#fbbf24' : '#4ade80', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {testMode ? 'Test Mode' : 'Live Mode'}
          </span>
        </div>

        {/* Exit preview */}
        <Link
          to="/"
          className="sidebar-item flex items-center gap-2.5 px-3 py-2 rounded-xl no-underline"
          style={{ color: 'rgba(255,255,255,0.28)', fontSize: '12px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.28)'; }}
        >
          <ArrowLeft size={13} />
          <span>Exit Preview</span>
        </Link>
      </div>
    </aside>
  );
}
