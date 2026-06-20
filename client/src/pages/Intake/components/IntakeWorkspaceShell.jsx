import { Link, useLocation } from 'react-router-dom';
import {
  ClipboardList, LayoutDashboard, Send, Users, Shield, Navigation,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'All Leads' },
  { to: '/intake', icon: ClipboardList, label: 'Intake', intake: true },
  { to: '/send', icon: Send, label: 'Send Template' },
  { to: '/tools/route-finder', icon: Navigation, label: 'Route Finder' },
];

export default function IntakeWorkspaceShell({ children }) {
  const { pathname } = useLocation();

  return (
    <div className="intake-workspace">
      <aside className="intake-workspace__sidebar" aria-label="Intake navigation">
        <div className="intake-workspace__brand">
          <div className="intake-workspace__brand-icon">
            <Shield size={18} />
          </div>
          <div>
            <p className="intake-workspace__brand-title">Green Shield</p>
            <p className="intake-workspace__brand-sub">Pest Solutions CRM</p>
          </div>
        </div>

        <nav className="intake-workspace__nav">
          <p className="intake-workspace__nav-label">Workspace</p>
          {NAV_ITEMS.map(({ to, icon: Icon, label, intake }) => {
            const active = intake
              ? pathname === '/intake' || pathname.startsWith('/intake/')
              : pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`intake-workspace__nav-item${active ? ' is-active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="intake-workspace__sidebar-foot">
          <span className="intake-workspace__live-dot" />
          <span>Sales workspace</span>
        </div>
      </aside>

      <div className="intake-workspace__content">
        {children}
      </div>
    </div>
  );
}
