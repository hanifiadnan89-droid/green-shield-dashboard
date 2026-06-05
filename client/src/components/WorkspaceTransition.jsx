/**
 * In-page panel / swap — no Framer Motion (avoids layout + presence overhead).
 * Route changes handle page-level enter via CSS in PageTransition.jsx.
 */

export function WorkspacePanel({ show, children, className = '', ariaLabel }) {
  if (!show) return null;
  return (
    <div className={className} aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export function WorkspaceSwap({ swapKey, children, className = '' }) {
  return (
    <div className={className} key={swapKey}>
      {children}
    </div>
  );
}
