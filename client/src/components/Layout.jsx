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
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-white border-r border-gs-border flex flex-col shrink-0"
             style={{ boxShadow: '1px 0 0 rgba(0,0,0,0.04)' }}>

        {/* Brand */}
        <div className="px-4 py-5 border-b border-gs-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-green-50 border border-green-200">
              <Shield size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-gs-text font-bold text-sm leading-tight tracking-tight">Green Shield</p>
              <p className="text-gs-muted text-xs tracking-wide">Control Center</p>
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
                    ? 'bg-green-50 text-green-700 font-semibold'
                    : 'text-gs-muted hover:text-gs-text hover:bg-slate-50'
                }`
              }
              style={({ isActive }) =>
                isActive ? { boxShadow: 'inset 3px 0 0 #16a34a' } : {}
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
        <div className="px-3 py-3 border-t border-gs-border">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide ${
            testMode
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${
              testMode ? 'bg-amber-500' : 'bg-green-500'
            }`} />
            {testMode ? 'TEST MODE' : 'LIVE MODE'}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
