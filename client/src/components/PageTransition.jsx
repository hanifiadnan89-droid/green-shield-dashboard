import { useRef, useEffect } from 'react';
import { Suspense } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  getWorkspaceSlideDirection,
  workspaceRouteKey,
  workspaceRouteVariants,
} from '../motion/workspaceMotion.js';
import PageTransitionFallback from './PageTransitionFallback.jsx';

/**
 * Route outlet transitions.
 *
 * IMPORTANT: mode must be "wait" — never "sync". Sync keeps the exiting AND
 * entering pages fully mounted (duplicate intervals, API loads, Playwright hooks)
 * which freezes the app during rapid sidebar navigation.
 */
export function AnimatedOutlet({ className = 'page-transition-outlet' }) {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const prevPath = useRef(location.pathname);
  const directionRef = useRef(1);

  const routeKey = workspaceRouteKey(location.pathname);
  directionRef.current = getWorkspaceSlideDirection(prevPath.current, location.pathname);

  useEffect(() => {
    prevPath.current = location.pathname;
  }, [location.pathname]);

  if (reduceMotion) {
    return (
      <div className={className}>
        <Suspense fallback={<PageTransitionFallback />}>{outlet}</Suspense>
      </div>
    );
  }

  const variants = workspaceRouteVariants(directionRef.current);

  return (
    <div className={`workspace-stage ${className}`.trim()}>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={routeKey}
          className="workspace-stage__layer"
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
        >
          <Suspense fallback={<PageTransitionFallback />}>{outlet}</Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** @deprecated Use AnimatedOutlet inside AppShell */
export function AnimatedPage({ children, className = '' }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const prevPath = useRef(location.pathname);
  const directionRef = useRef(1);

  const routeKey = workspaceRouteKey(location.pathname);
  directionRef.current = getWorkspaceSlideDirection(prevPath.current, location.pathname);

  useEffect(() => {
    prevPath.current = location.pathname;
  }, [location.pathname]);

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const variants = workspaceRouteVariants(directionRef.current);

  return (
    <div className={`workspace-stage ${className}`.trim()}>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={routeKey}
          className="workspace-stage__layer"
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
