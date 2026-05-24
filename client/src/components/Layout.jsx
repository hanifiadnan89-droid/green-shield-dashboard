import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Send, Workflow, Clock, Activity,
  Shield
} from 'lucide-react';

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',    iconAnim: 'dashboard' },
  { to: '/leads',     icon: Users,           label: 'Leads',        iconAnim: 'leads'     },
  { to: '/send',      icon: Send,            label: 'Send Template', iconAnim: 'send'     },
  { to: '/workflows', icon: Workflow,        label: 'Workflows',    iconAnim: 'workflows' },
  { to: '/followups', icon: Clock,           label: 'Follow-ups',   iconAnim: 'followups' },
  { to: '/activity',  icon: Activity,        label: 'Activity Log', iconAnim: 'activity'  },
];

export default function Layout({ children, testMode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gs-bg">
      <aside className="w-56 border-r border-white/10 flex flex-col shrink-0"
             style={{
               background: 'linear-gradient(180deg, #0d2411 0%, #07170a 100%)',
               boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.06), 16px 0 40px rgba(7,23,10,0.12)',
             }}>

        {/* Brand */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg border border-green-300/25 bg-green-400/10 shadow-glow-green">
              <Shield size={16} className="text-green-300" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight tracking-tight">Green Shield</p>
              <p className="text-white/35 text-xs tracking-wide">Control Center</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, iconAnim }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-green-400/15 text-green-100 font-semibold'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`
              }
              style={({ isActive }) =>
                isActive ? { boxShadow: 'inset 3px 0 0 #4ade80, 0 10px 24px rgba(0,0,0,0.10)' } : {}
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`nav-icon nav-icon-${iconAnim}${isActive ? ' nav-icon-active' : ''}`}>
                    <Icon size={16} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Mode indicator */}
        <div className="px-3 py-3 border-t border-white/10">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide ${
            testMode
              ? 'bg-amber-500/10 text-amber-300 border border-amber-300/20'
              : 'bg-green-400/10 text-green-300 border border-green-300/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${
              testMode ? 'bg-amber-500' : 'bg-green-500'
            }`} />
            {testMode ? 'TEST MODE' : 'LIVE MODE'}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-gs-bg">
        {children}
      </div>
    </div>
  );
}
