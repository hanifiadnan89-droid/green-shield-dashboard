import { useRef, useEffect } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  getWorkspaceSlideDirection,
  workspaceRouteKey,
  workspaceRouteVariants,
} from '../motion/workspaceMotion.js';

/**
 * Wraps a single page element (legacy — prefer AppShell + AnimatedOutlet).
 */
export function AnimatedPage({ children, className = '' }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const prevPath = useRef(location.pathname);
  const direction = getWorkspaceSlideDirection(prevPath.current, location.pathname);

  useEffect(() => {
    prevPath.current = location.pathname;
  }, [location.pathname]);

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const variants = workspaceRouteVariants(direction);
  const routeKey = workspaceRouteKey(location.pathname, location.search);

  return (
    <div className={`workspace-stage ${className}`.trim()}>
      <AnimatePresence initial={false} mode="sync">
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

/**
 * Animated React Router outlet inside Layout (sidebar stays fixed).
 */
export function AnimatedOutlet({ className = 'page-transition-outlet' }) {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const prevPath = useRef(location.pathname);
  const direction = getWorkspaceSlideDirection(prevPath.current, location.pathname);

  useEffect(() => {
    prevPath.current = location.pathname;
  }, [location.pathname]);

  if (reduceMotion) {
    return <div className={className}>{outlet}</div>;
  }

  const variants = workspaceRouteVariants(direction);
  const routeKey = workspaceRouteKey(location.pathname, location.search);

  return (
    <div className={`workspace-stage ${className}`.trim()}>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={routeKey}
          className="workspace-stage__layer"
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
