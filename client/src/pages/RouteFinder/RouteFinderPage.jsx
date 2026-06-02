import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import RouteFinderWidget from '../CRMPreview/components/RouteFinderWidget.jsx';
import '../CRMPreview/preview.css';

export default function RouteFinderPage() {
  return (
    <div className="crm-preview route-finder-page flex flex-col flex-1 min-h-0 overflow-hidden bg-gs-bg">
      <header className="route-finder-page__header shrink-0 px-4 lg:px-8 py-4 border-b border-gs-border bg-gs-bg flex items-center gap-3">
        <Link
          to="/"
          className="route-finder-page__back inline-flex items-center gap-1.5 text-xs font-semibold text-gs-muted no-underline hover:text-gs-accent transition-colors"
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span className="text-gs-border hidden sm:inline" aria-hidden>|</span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gs-text m-0 leading-tight">Route Finder</h1>
          <p className="text-xs text-gs-muted mt-0.5 m-0">
            FieldRoutes scheduling — best technician for a new stop
          </p>
        </div>
      </header>

      <main className="route-finder-page__main flex-1 overflow-y-auto px-4 lg:px-8 py-5 lg:py-6">
        <RouteFinderWidget variant="page" />
      </main>
    </div>
  );
}
