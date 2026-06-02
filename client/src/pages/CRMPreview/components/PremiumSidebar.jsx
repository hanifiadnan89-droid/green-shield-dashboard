import { useState, useEffect, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Send, Workflow, Clock, Activity,
  MessageSquare, AlertCircle, StopCircle, Menu, X, Navigation,
} from 'lucide-react';

const NAV = [
  {
    group: 'WORKSPACE',
    items: [
      { type: 'home',   icon: LayoutDashboard, label: 'Dashboard'   },
      { type: 'link',   to: '/leads',          icon: Users,         label: 'All Leads'    },
      { type: 'link',   to: '/followups',      icon: Clock,         label: 'Follow-ups'   },
      { type: 'link',   to: '/replies',        icon: MessageSquare, label: 'Replies',     badge: 'replied' },
    ],
  },
  {
    group: 'FILTERS',
    items: [
      { type: 'filter', filterKey: 'errors',     icon: AlertCircle, label: 'Errors',      badge: 'errors',     urgent: true },
      { type: 'filter', filterKey: 'stopped',    icon: StopCircle,  label: 'Stopped',     badge: 'stopped'                 },
      { type: 'filter', filterKey: 'inprogress', icon: Clock,       label: 'In Progress', badge: 'inProgress'              },
    ],
  },
  {
    group: 'TOOLS',
    items: [
      { type: 'link', to: '/tools/route-finder', icon: Navigation, label: 'Route Finder'   },
      { type: 'link', to: '/send',               icon: Send,       label: 'Send Template' },
      { type: 'link', to: '/workflows',          icon: Workflow,   label: 'Workflows'     },
      { type: 'link', to: '/activity',           icon: Activity,   label: 'Activity Log'  },
    ],
  },
];

function itemIsActive(item, activeFilter, pathname) {
  if (item.type === 'home')   return pathname === '/' && activeFilter === 'all';
  if (item.type === 'filter') return pathname === '/' && activeFilter === item.filterKey;
  if (item.type === 'link')   return pathname === item.to;
  return false;
}

function PremiumSidebar({ stats, testMode, activeFilter, onFilterChange, unreadReplies = 0 }) {
  const [isMobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  // Close drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function getBadgeCount(key) {
    if (!key) return 0;
    if (key === 'replied') return unreadReplies;
    if (!stats) return 0;
    return stats[key] ?? 0;
  }

  function handleItemClick(item) {
    if (item.type === 'home')   { onFilterChange('all'); return; }
    if (item.type === 'filter') { onFilterChange(item.filterKey); return; }
  }

  return (
    <>
      {/* ── Mobile hamburger — visible only on < lg when drawer is closed ── */}
      {!isMobileOpen && (
        <button
          className="fixed top-4 left-4 z-50 lg:hidden flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer"
          style={{
            background: 'rgba(8,15,10,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.30)',
          }}
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={16} style={{ color: 'rgba(255,255,255,0.75)' }} />
        </button>
      )}

      {/* ── Mobile overlay backdrop ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-[55] lg:hidden bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          'premium-sidebar',
          'fixed inset-y-0 left-0 z-[60]',
          'lg:relative lg:inset-auto lg:z-auto',
          'flex flex-col shrink-0 overflow-hidden',
          'w-[260px]',
          'transition-transform duration-300 ease-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >

        {/* Header — 64px min-height, logo + mobile close */}
        <div
          className="px-5 py-4 flex items-center gap-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: '64px' }}
        >
          {/* Shield logomark */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(74,222,128,0.18), rgba(22,163,74,0.10))',
            border: '1px solid rgba(134,239,172,0.28)',
            borderRadius: '10px',
            padding: '8px',
            display: 'inline-flex',
            flexShrink: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 20px rgba(0,0,0,0.18)',
          }}>
            <Shield size={17} style={{ color: '#4ade80' }} />
          </div>

          {/* Wordmark */}
          <div className="flex-1 min-w-0">
            <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px', lineHeight: 1.2, fontFamily: 'Poppins, Inter, system-ui' }}>
              Green Shield
            </p>
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '11px', lineHeight: 1.4 }}>
              Pest Solutions CRM
            </p>
          </div>

          {/* Mobile close button (only rendered on small screens) */}
          <button
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <p className="sidebar-group-label">{group}</p>

              <div className="space-y-0.5">
                {items.map((item) => {
                  const { icon: Icon, label, badge, urgent, type, to } = item;
                  const isActive = itemIsActive(item, activeFilter, pathname);
                  const count    = badge ? getBadgeCount(badge) : 0;

                  const itemContent = (
                    <>
                      <div className="flex items-center gap-2.5">
                        <Icon
                          size={15}
                          style={{
                            color: isActive ? '#4ade80' : 'rgba(255,255,255,0.35)',
                            flexShrink: 0,
                            transition: 'color 150ms ease',
                          }}
                        />
                        <span style={{
                          color:      isActive ? '#F0FDF4' : 'rgba(255,255,255,0.50)',
                          fontSize:   '13px',
                          fontWeight: isActive ? 500 : 400,
                          lineHeight: 1.4,
                          transition: 'color 150ms ease',
                        }}>
                          {label}
                        </span>
                      </div>

                      {count > 0 && (
                        <span
                          className="sidebar-badge"
                          style={{
                            background: urgent ? '#DC2626' : 'rgba(74,222,128,0.20)',
                            color:      urgent ? '#ffffff' : '#4ade80',
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  );

                  const baseClass = `sidebar-item w-full flex items-center justify-between gap-2 px-3 py-[9px] rounded-xl${isActive ? ' is-active' : ''}`;

                  if (type === 'link') {
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`${baseClass} no-underline`}
                        onClick={() => setMobileOpen(false)}
                      >
                        {itemContent}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={label}
                      onClick={() => handleItemClick(item)}
                      className={`${baseClass} cursor-pointer`}
                      style={{ textAlign: 'left' }}
                    >
                      {itemContent}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer — mode indicator */}
        <div
          className="px-3 pb-4 pt-3 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{
              background: testMode ? 'rgba(217,119,6,0.10)' : 'rgba(22,163,74,0.10)',
              border: `1px solid ${testMode ? 'rgba(217,119,6,0.20)' : 'rgba(22,163,74,0.18)'}`,
            }}
          >
            <span
              className="animate-pulse shrink-0"
              style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background:  testMode ? '#F59E0B' : '#22c55e',
                display:     'inline-block',
                boxShadow:   testMode ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(34,197,94,0.5)',
              }}
            />
            <span style={{
              color:          testMode ? '#fbbf24' : '#4ade80',
              fontSize:       '11px',
              fontWeight:     700,
              letterSpacing:  '0.06em',
              textTransform:  'uppercase',
            }}>
              {testMode ? 'Test Mode' : 'Live Mode'}
            </span>
          </div>
        </div>

      </aside>
    </>
  );
}

export default memo(PremiumSidebar);
