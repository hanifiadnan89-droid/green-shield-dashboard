import { useLayoutEffect, useState } from 'react';

/**
 * Mount point for route-match overlays: confined to the Route Finder workspace
 * (main column), not the viewport — avoids a fixed left offset beside the sidebar.
 */
export function useRouteMatchPortalRoot() {
  const [root, setRoot] = useState(null);

  useLayoutEffect(() => {
    setRoot(
      document.querySelector('.route-finder-page')
        || document.querySelector('.route-finder-widget--page')
        || document.querySelector('.route-finder-results-panel')
        || null,
    );
  }, []);

  return root;
}
