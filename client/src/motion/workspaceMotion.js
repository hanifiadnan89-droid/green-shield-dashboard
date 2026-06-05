/** Premium command-center motion — shared across route and panel transitions */

export const WORKSPACE_EASE = [0.22, 1, 0.36, 1];

export const WORKSPACE_DURATION = {
  route: 0.24,
  panel: 0.22,
  swap: 0.18,
};

/** Sidebar route order — used for subtle L/R slide direction */
export const WORKSPACE_ROUTE_ORDER = [
  '/',
  '/leads',
  '/followups',
  '/replies',
  '/tools/route-finder',
  '/send',
  '/workflows',
  '/activity',
  '/component-preview',
];

/** One key per route path — query changes (e.g. leads filters) must not remount the page. */
export function workspaceRouteKey(pathname) {
  return pathname || '/';
}

function routeIndex(pathname) {
  const i = WORKSPACE_ROUTE_ORDER.findIndex(
    p => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`)),
  );
  return i >= 0 ? i : WORKSPACE_ROUTE_ORDER.length;
}

export function getWorkspaceSlideDirection(fromPath, toPath) {
  const from = routeIndex(fromPath);
  const to = routeIndex(toPath);
  if (from === to) return 0;
  return to > from ? 1 : -1;
}

const SLIDE_PX = 14;

export function workspaceRouteVariants(direction = 1) {
  const enterX = SLIDE_PX * direction;
  const exitX = -SLIDE_PX * 0.6 * direction;
  return {
    initial: { opacity: 0, x: enterX },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: WORKSPACE_DURATION.route,
        ease: WORKSPACE_EASE,
      },
    },
    exit: {
      opacity: 0,
      x: exitX,
      pointerEvents: 'none',
      transition: {
        duration: WORKSPACE_DURATION.route * 0.8,
        ease: WORKSPACE_EASE,
      },
    },
  };
}

export function workspacePanelVariants(side = 'right') {
  const x = side === 'right' ? 20 : -20;
  return {
    initial: { opacity: 0, x },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: WORKSPACE_DURATION.panel, ease: WORKSPACE_EASE },
    },
    exit: {
      opacity: 0,
      x: x * 0.75,
      transition: { duration: WORKSPACE_DURATION.panel * 0.9, ease: WORKSPACE_EASE },
    },
  };
}

export function workspaceSwapVariants() {
  return {
    initial: { opacity: 0, y: 6 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: WORKSPACE_DURATION.swap, ease: WORKSPACE_EASE },
    },
    exit: {
      opacity: 0,
      y: -4,
      transition: { duration: WORKSPACE_DURATION.swap * 0.85, ease: WORKSPACE_EASE },
    },
  };
}
