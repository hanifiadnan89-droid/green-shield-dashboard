import RouteFinderWidget from '../CRMPreview/components/RouteFinderWidget.jsx';
import '../CRMPreview/preview.css';

/**
 * Full-workspace Route Finder (Tools → Route Finder).
 * Navigation is via the sidebar only — no duplicate Dashboard back link.
 */
export default function RouteFinderPage() {
  return (
    <div className="crm-preview route-finder-page flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden bg-gs-bg">
      <RouteFinderWidget variant="page" />
    </div>
  );
}
