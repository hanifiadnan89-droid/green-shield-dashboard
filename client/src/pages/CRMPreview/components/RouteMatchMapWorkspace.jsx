import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import RouteGoogleMap from './RouteGoogleMap.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function RouteMatchMapWorkspace({ match, onBack }) {
  const panelRef = useRef(null);
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

  return createPortal(
    <motion.div
      className="crm-preview route-match-workspace route-match-workspace--map"
      role="dialog"
      aria-modal="true"
      aria-label={`Full route map for ${match.techName}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className="route-match-map-full"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.34, ease: EASE }}
      >
        <header className="route-match-map-full__header">
          <button type="button" className="route-match-detail__back" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden />
            Back to Technician Details
          </button>
          <p className="route-match-map-full__title m-0">
            {match.techName} · Route {match.routeId}
          </p>
        </header>
        <RouteGoogleMap
          stops={stops}
          mapType="satellite"
          interactive
          showControls
          compact={false}
        />
      </motion.div>
    </motion.div>,
    document.body,
  );
}
