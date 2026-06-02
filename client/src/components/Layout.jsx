import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Send, Workflow, Clock, Activity,
  Shield, MessageCircle, Navigation,
} from 'lucide-react';
import { api } from '../api/client.js';

const isRealReply = l => {
  const t = (l.sms_reply || '').trim();
  return t.length > 0 && t !== '.';
};
const replyKey = l => `${l.row_number}:${l.sms_reply}`;

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',    iconAnim: 'dashboard' },
  { to: '/leads',     icon: Users,           label: 'Leads',        iconAnim: 'leads'     },
  { to: '/send',      icon: Send,            label: 'Send Template', iconAnim: 'send'     },
  { to: '/replies',   icon: MessageCircle,   label: 'Replies',      iconAnim: 'replies', hasBadge: true },
  { to: '/workflows', icon: Workflow,        label: 'Workflows',    iconAnim: 'workflows' },
  { to: '/followups', icon: Clock,           label: 'Follow-ups',   iconAnim: 'followups' },
  { to: '/activity',  icon: Activity,        label: 'Activity Log', iconAnim: 'activity'  },
  { to: '/tools/route-finder', icon: Navigation, label: 'Route Finder', iconAnim: 'routes' },
];

export default function Layout({ children, testMode }) {
  const [replyBadge, setReplyBadge] = useState(0);
  const viewedRef = useRef(
    new Set(JSON.parse(localStorage.getItem('gs_viewed_replies') || '[]'))
  );

  useEffect(() => {
    const compute = async () => {
      try {
        const { leads } = await api.leads.list();
        const replyLeads = (leads || []).filter(isRealReply);
        const unviewed = replyLeads.filter(l => !viewedRef.current.has(replyKey(l)));
        setReplyBadge(unviewed.length);
      } catch {}
    };
    compute();
    const id = setInterval(compute, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      (e.detail || []).forEach(key => viewedRef.current.add(key));
      localStorage.setItem('gs_viewed_replies', JSON.stringify([...viewedRef.current]));
      setReplyBadge(0);
    };
    window.addEventListener('replies-viewed', handler);
    return () => window.removeEventListener('replies-viewed', handler);
  }, []);

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
          {NAV.map(({ to, icon: Icon, label, iconAnim, hasBadge }) => (
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
                  <span className="relative inline-flex shrink-0">
                    <span className={`nav-icon nav-icon-${iconAnim}${isActive ? ' nav-icon-active' : ''}`}>
                      <Icon size={16} />
                    </span>
                    {hasBadge && replyBadge > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 h-[14px] min-w-[14px] rounded-full text-white text-[9px] font-bold flex items-center justify-center px-[3px] leading-none"
                        style={{
                          background: '#dc2626',
                          boxShadow: '0 0 0 1.5px #0d2411',
                        }}
                      >
                        {replyBadge > 9 ? '9+' : replyBadge}
                      </span>
                    )}
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

      <div className="flex-1 flex flex-col overflow-hidden bg-gs-bg min-w-0 w-full">
        {children}
      </div>
    </div>
  );
}
