import { useState, useEffect, memo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { SIDEBAR_NAV } from './sidebarNav.js';
import { prefetchRoute } from '../utils/routePrefetch.js';
import { isIntakeEnabled } from '../utils/intake/intakeFeatureFlag.js';
import { api } from '../api/client.js';
import './app-sidebar.css';

async function handleSignOut() {
  try { await api.auth.logout(); } catch {}
  try { window.dispatchEvent(new CustomEvent('gs:auth-expired')); } catch {}
}

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
  return SIDEBAR_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.feature === 'intake') return isIntakeEnabled();
      return true;
    }),
  })).filter((section) => section.items.length > 0);
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

  function renderItem(item) {
    const { icon: Icon, label, badge, urgent, type, to, filterKey } = item;
    const isActive = itemIsActive(item, activeFilter, pathname, leadsCategory);
    const count = badge ? getBadgeCount(badge) : 0;
    const isStatic = type === 'static';

    const itemContent = (
      <>
        <div className="flex items-center gap-2.5">
          <Icon
            size={16}
            style={{
              color: isActive ? '#86efac' : 'rgba(255,255,255,0.38)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: isActive ? '#F0FDF4' : 'rgba(255,255,255,0.58)',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              lineHeight: 1.4,
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

    const baseClass = `sidebar-item w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl${
      isActive ? ' is-active' : ''
    }${isStatic ? ' is-static' : ''}`;
    const closeMobile = () => setMobileOpen(false);

    if (type === 'static') {
      return (
        <div key={label} className={baseClass} aria-disabled="true">
          {itemContent}
        </div>
      );
    }

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
            onClick={() => { handleDashboardFilter(item); closeMobile(); }}
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
            onClick={() => { handleDashboardFilter(item); closeMobile(); }}
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
          'w-[272px]',
          'transition-transform duration-300 ease-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <button
          type="button"
          className="sidebar-close lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X size={13} />
        </button>

        <div className="sidebar-brand shrink-0">
          <img
            src="/green-shield-logo-sidebar.png"
            alt="Green Shield Pest Solutions"
            className="sidebar-brand__logo"
          />
        </div>

        <nav className="sidebar-nav flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {visibleSidebarNav().map(({ group, items }) => (
            <div key={group}>
              <p className="sidebar-group-label">{group}</p>
              <div className="space-y-0.5">
                {items.map((item) => renderItem(item))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer shrink-0 px-3 pb-4 pt-2">
          <div className={`sidebar-mode-pill${testMode ? ' is-test' : ''}`}>
            <span className="sidebar-mode-pill__dot" />
            <span className="sidebar-mode-pill__label">{testMode ? 'Test Mode' : 'Live Mode'}</span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="sidebar-signout"
            title="Sign out"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default memo(AppSidebar);
