/** Warm lazy route chunks on sidebar hover/focus (reduces navigation stall). */
const loaders = {
  '/': () => import('../pages/CRMPreview/index.jsx'),
  '/leads': () => import('../pages/Leads.jsx'),
  '/send': () => import('../pages/SendTemplate.jsx'),
  '/replies': () => import('../pages/Replies.jsx'),
  '/workflows': () => import('../pages/Workflows.jsx'),
  '/followups': () => import('../pages/Followups.jsx'),
  '/activity': () => import('../pages/ActivityLog.jsx'),
  '/tools/route-finder': () => import('../pages/RouteFinder/RouteFinderPage.jsx'),
};

const warmed = new Set();

export function prefetchRoute(path) {
  const loader = loaders[path];
  if (!loader || warmed.has(path)) return;
  warmed.add(path);
  loader().catch(() => {
    warmed.delete(path);
  });
}
