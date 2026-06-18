import { useState, useEffect, memo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Shield, Menu, X } from 'lucide-react';
import { SIDEBAR_NAV } from './sidebarNav.js';
import { prefetchRoute } from '../utils/routePrefetch.js';
import { isIntakeEnabled } from '../utils/intake/intakeFeatureFlag.js';
import './app-sidebar.css';

function itemIsActive(item, activeFilter, pathname, leadsCategory) {
  if (item.type === 'home') {
    return pathname === '/' && activeFilter === 'all' && !leadsCategory;
  }
  if (item.type === 'filter') {
    if (pathname === '/') return activeFilter === item.filterKey;
    if (pathname === '/leads') return leadsCategory === item.filterKey;
    return false;
  }
  if (item.type === 'link' && item.to === '/intake') {
    return pathname === '/intake' || pathname.startsWith('/intake/');
  }
  if (item.type === 'link') return pathname === item.to;
  return false;
}

function visibleSidebarNav() {
  return SIDEBAR_NAV.filter((section) => {
    if (section.feature === 'intake') return isIntakeEnabled();
    return true;
  });
}

function AppSidebar({
  stats,
  testMode,
  activeFilter = 'all',
  onFilterChange,
  unreadReplies = 0,
}) {
  const [isMobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const leadsCategory = pathname === '/leads' ? (searchParams.get('category') || '') : '';
  const onDashboard = pathname === '/';

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function getBadgeCount(key) {
    if (!key) return 0;
    if (key === 'replied') return unreadReplies;
    if (!stats) return 0;
    return stats[key] ?? 0;
  }

  function handleDashboardFilter(item) {
    if (item.type === 'home') {
      onFilterChange?.('all');
      return;
    }
    if (item.type === 'filter') {
      onFilterChange?.(item.filterKey);
    }
  }

  return (
    <>
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

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-[55] lg:hidden bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

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
        style={{ borderRight: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div
          className="px-5 py-4 flex items-center gap-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', minHeight: '64px' }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(74,222,128,0.18), rgba(22,163,74,0.10))',
              border: '1px solid rgba(134,239,172,0.28)',
              borderRadius: '10px',
              padding: '8px',
              display: 'inline-flex',
              flexShrink: 0,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 20px rgba(0,0,0,0.18)',
            }}
          >
            <Shield size={17} style={{ color: '#4ade80' }} />
          </div>

          <div className="flex-1 min-w-0">
            <p
              style={{
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                lineHeight: 1.2,
                fontFamily: 'Poppins, Inter, system-ui',
              }}
            >
              Green Shield
            </p>
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '11px', lineHeight: 1.4 }}>
              Pest Solutions CRM
            </p>
          </div>

          <button
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {visibleSidebarNav().map(({ group, items }) => (
            <div key={group}>
              <p className="sidebar-group-label">{group}</p>

              <div className="space-y-0.5">
                {items.map((item) => {
                  const { icon: Icon, label, badge, urgent, type, to, filterKey } = item;
                  const isActive = itemIsActive(item, activeFilter, pathname, leadsCategory);
                  const count = badge ? getBadgeCount(badge) : 0;

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
                        <span
                          style={{
                            color: isActive ? '#F0FDF4' : 'rgba(255,255,255,0.50)',
                            fontSize: '13px',
                            fontWeight: isActive ? 500 : 400,
                            lineHeight: 1.4,
                            transition: 'color 150ms ease',
                          }}
                        >
                          {label}
                        </span>
                      </div>

                      {count > 0 && (
                        <span
                          className="sidebar-badge"
                          style={{
                            background: urgent ? '#DC2626' : 'rgba(74,222,128,0.20)',
                            color: urgent ? '#ffffff' : '#4ade80',
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  );

                  const baseClass = `sidebar-item w-full flex items-center justify-between gap-2 px-3 py-[9px] rounded-xl${isActive ? ' is-active' : ''}`;
                  const closeMobile = () => setMobileOpen(false);

                  if (type === 'link') {
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`${baseClass} no-underline`}
                        onClick={closeMobile}
                        onMouseEnter={() => prefetchRoute(to)}
                        onFocus={() => prefetchRoute(to)}
                      >
                        {itemContent}
                      </Link>
                    );
                  }

                  if (type === 'home') {
                    if (onDashboard && onFilterChange) {
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            handleDashboardFilter(item);
                            closeMobile();
                          }}
                          className={`${baseClass} cursor-pointer`}
                          style={{ textAlign: 'left' }}
                        >
                          {itemContent}
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={label}
                        to="/"
                        className={`${baseClass} no-underline`}
                        onClick={closeMobile}
                        onMouseEnter={() => prefetchRoute('/')}
                        onFocus={() => prefetchRoute('/')}
                      >
                        {itemContent}
                      </Link>
                    );
                  }

                  if (type === 'filter') {
                    if (onDashboard && onFilterChange) {
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            handleDashboardFilter(item);
                            closeMobile();
                          }}
                          className={`${baseClass} cursor-pointer`}
                          style={{ textAlign: 'left' }}
                        >
                          {itemContent}
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={label}
                        to={`/leads?category=${filterKey}`}
                        className={`${baseClass} no-underline`}
                        onClick={closeMobile}
                        onMouseEnter={() => prefetchRoute('/leads')}
                        onFocus={() => prefetchRoute('/leads')}
                      >
                        {itemContent}
                      </Link>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          ))}
        </nav>

        <div
          className="px-3 pb-4 pt-3 shrink-0"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
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
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: testMode ? '#F59E0B' : '#22c55e',
                display: 'inline-block',
                boxShadow: testMode ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(34,197,94,0.5)',
              }}
            />
            <span
              style={{
                color: testMode ? '#fbbf24' : '#4ade80',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {testMode ? 'Test Mode' : 'Live Mode'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default memo(AppSidebar);
