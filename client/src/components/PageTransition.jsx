import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/** Premium workspace transition — 200–350ms, no interaction blocking */
export const PAGE_MOTION = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
};

const enter = { opacity: 0, y: 10 };
const center = { opacity: 1, y: 0 };
const exit = { opacity: 0, y: -6 };

/**
 * Wraps a single page element (e.g. dashboard route outside AppShell).
 */
export function AnimatedPage({ children, className = '' }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className={`page-transition ${className}`.trim()}
        initial={enter}
        animate={center}
        exit={exit}
        transition={PAGE_MOTION}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Animated React Router outlet inside Layout (sidebar stays fixed).
 */
export function AnimatedOutlet({ className = 'page-transition-outlet' }) {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{outlet}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className={className}
        initial={enter}
        animate={center}
        exit={exit}
        transition={PAGE_MOTION}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
