import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ArrowLeft, X } from 'lucide-react';
import RouteGoogleMap from './RouteGoogleMap.jsx';
import { useRouteMatchPortalRoot } from './RouteFinder/useRouteMatchPortalRoot.js';

const EASE = [0.22, 1, 0.36, 1];

export default function RouteMatchMapWorkspace({
  match,
  onBack,
  roadPolyline = null,
  inline = false,
}) {
  const panelRef = useRef(null);
  const portalRoot = useRouteMatchPortalRoot();
  const stops = match.routeStops || [];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const workspace = (
    <motion.div
      className={[
        'crm-preview route-match-workspace route-match-workspace--map',
        inline ? 'route-match-workspace--inline-overlay' : '',
      ].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={`Full route map for ${match.techName}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      <motion.button
        type="button"
        className="route-match-workspace__backdrop-top"
        aria-label="Back to technician details"
        onClick={onBack}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.32, ease: EASE }}
      />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className="route-match-map-full"
        initial={{ y: 22, opacity: 0.96 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 18, opacity: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <header className="route-match-map-full__header">
          <button type="button" className="route-match-detail__back" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden />
            Back to Technician Details
          </button>
          <p className="route-match-map-full__title m-0">
            {match.techName} · Route {match.routeId}
          </p>
          <button
            type="button"
            className="route-match-map-full__close"
            onClick={onBack}
            aria-label="Close full map view"
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </header>
        <RouteGoogleMap
          stops={stops}
          mapType="satellite"
          interactive
          showControls
          compact={false}
          roadPolyline={roadPolyline}
        />
      </motion.div>
    </motion.div>
  );

  if (inline) return workspace;

  const mount = portalRoot || document.body;
  return createPortal(workspace, mount);
}
