import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { WORKSPACE_EASE, WORKSPACE_DURATION, workspacePanelVariants } from '../motion/workspaceMotion.js';

/**
 * Side panel (lead detail, etc.) — one panel at a time (wait).
 */
export function WorkspacePanel({
  show,
  children,
  className = '',
  side = 'right',
  ariaLabel,
}) {
  const reduceMotion = useReducedMotion();
  const variants = workspacePanelVariants(side);

  if (reduceMotion) {
    return show ? <div className={className} aria-label={ariaLabel}>{children}</div> : null;
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      {show ? (
        <motion.div
          key="panel"
          className={className}
          aria-label={ariaLabel}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * In-place content swap — enter-only animation so previous view unmounts immediately.
 * Avoids stacking two heavy trees (e.g. two reply conversation panels).
 */
export function WorkspaceSwap({ swapKey, children, className = '' }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`workspace-swap ${className}`.trim()}>
      <motion.div
        key={swapKey}
        className="workspace-swap__layer"
        initial={{ opacity: 0, y: 5 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: WORKSPACE_DURATION.swap, ease: WORKSPACE_EASE },
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
