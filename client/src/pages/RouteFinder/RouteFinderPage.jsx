import { motion } from 'motion/react';
import RouteFinderWidget from '../CRMPreview/components/RouteFinderWidget.jsx';
import LeadsAmbientBackground from '../Leads/LeadsAmbientBackground.jsx';
import './route-finder-command.css';

/**
 * Full-workspace Route Finder (Tools → Route Finder).
 * Navigation is via the sidebar only — no duplicate Dashboard back link.
 */
export default function RouteFinderPage() {
  return (
    <div className="rf-command-page">
      <LeadsAmbientBackground />
      <div className="rf-command-page__inner">
        <div className="lc-live-bar">
          <span className="lc-live" aria-live="polite">
            <motion.span
              className="lc-live__dot"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Live mode
          </span>
        </div>
        <RouteFinderWidget variant="page" />
      </div>
    </div>
  );
}
