import { Suspense, useLayoutEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import {
  workspaceRouteKey,
  getWorkspaceSlideDirection,
  WORKSPACE_DURATION,
} from '../motion/workspaceMotion.js';
import PageTransitionFallback from './PageTransitionFallback.jsx';

/**
 * Route outlet — enter-only CSS transition (opacity + transform).
 * No AnimatePresence: one route mounted at a time; dark shell stays visible between swaps.
 */
export function AnimatedOutlet({ className = 'page-transition-outlet' }) {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const routeKey = workspaceRouteKey(location.pathname);
  const stageRef = useRef(null);
  const prevPathRef = useRef(location.pathname);

  useLayoutEffect(() => {
    const dir = getWorkspaceSlideDirection(prevPathRef.current, location.pathname);
    prevPathRef.current = location.pathname;
    const el = stageRef.current;
    if (!el) return;
    if (reduceMotion || dir === 0) {
      el.style.setProperty('--workspace-enter-x', '0px');
    } else {
      el.style.setProperty('--workspace-enter-x', `${12 * dir}px`);
    }
  }, [location.pathname, reduceMotion]);

  const enterMs = Math.round(WORKSPACE_DURATION.route * 1000);

  return (
    <div ref={stageRef} className={`workspace-stage ${className}`.trim()}>
      <Suspense fallback={<PageTransitionFallback />}>
        <div
          key={routeKey}
          className={reduceMotion ? 'workspace-route' : 'workspace-route workspace-route--enter'}
          style={reduceMotion ? undefined : { animationDuration: `${enterMs}ms` }}
        >
          {outlet}
        </div>
      </Suspense>
    </div>
  );
}

/** @deprecated Use AnimatedOutlet inside AppShell */
export function AnimatedPage({ children, className = '' }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const routeKey = workspaceRouteKey(location.pathname);
  const enterMs = Math.round(WORKSPACE_DURATION.route * 1000);

  return (
    <div className={`workspace-stage ${className}`.trim()}>
      <div
        key={routeKey}
        className={reduceMotion ? 'workspace-route' : 'workspace-route workspace-route--enter'}
        style={reduceMotion ? undefined : { animationDuration: `${enterMs}ms` }}
      >
        {children}
      </div>
    </div>
  );
}
