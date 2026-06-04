import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { workspacePanelVariants, workspaceSwapVariants } from '../motion/workspaceMotion.js';

/**
 * Side panel (lead detail, etc.) — slides in as workspace extension, not a modal.
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
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className={className}
          aria-label={ariaLabel}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * In-place content swap (conversation, tabs, filters) — soft fade + micro slide.
 */
export function WorkspaceSwap({
  swapKey,
  children,
  className = '',
  mode = 'wait',
}) {
  const reduceMotion = useReducedMotion();
  const variants = workspaceSwapVariants();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`workspace-swap ${className}`.trim()}>
      <AnimatePresence initial={false} mode={mode}>
        <motion.div
          key={swapKey}
          className="workspace-swap__layer"
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
