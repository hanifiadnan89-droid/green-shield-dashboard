import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { workspaceRouteKey } from '../motion/workspaceMotion.js';
import PageTransitionFallback from './PageTransitionFallback.jsx';

/**
 * Route outlet — CSS enter fade only.
 *
 * No AnimatePresence / exit animations: they block navigation (wait mode)
 * or duplicate mounted pages (sync mode). Old route unmounts immediately on key change.
 */
export function AnimatedOutlet({ className = 'page-transition-outlet' }) {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const routeKey = workspaceRouteKey(location.pathname);

  return (
    <div className={`workspace-stage ${className}`.trim()}>
      <div
        key={routeKey}
        className={reduceMotion ? 'workspace-route' : 'workspace-route workspace-route--enter'}
      >
        <Suspense fallback={<PageTransitionFallback />}>{outlet}</Suspense>
      </div>
    </div>
  );
}

/** @deprecated Use AnimatedOutlet inside AppShell */
export function AnimatedPage({ children, className = '' }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const routeKey = workspaceRouteKey(location.pathname);

  return (
    <div className={`workspace-stage ${className}`.trim()}>
      <div
        key={routeKey}
        className={reduceMotion ? 'workspace-route' : 'workspace-route workspace-route--enter'}
      >
        {children}
      </div>
    </div>
  );
}
