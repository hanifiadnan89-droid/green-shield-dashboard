import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import RouteMatchCardContent from './RouteMatchCardContent.jsx';
import RouteMatchMapPreview from './RouteMatchMapPreview.jsx';
import { matchLayoutId, SCORE_BREAKDOWN } from './RouteFinder/routeMatchCardConfig.js';

const EASE = [0.22, 1, 0.36, 1];

export default function RouteMatchExpandedOverlay({ match, rank, routeArea, onClose }) {
  const panelRef = useRef(null);
  const [showAllStops, setShowAllStops] = useState(false);
  const stops = match.routeStops || [];
  const visibleStops = showAllStops ? stops : stops.slice(0, 8);
  const day = match.daySummary;
  const layoutId = matchLayoutId(match);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const scoreColor = (v) => (v >= 70 ? '#16A34A' : v >= 45 ? '#F59E0B' : '#94A3B8');

  return createPortal(
      <motion.div
        className="crm-preview route-match-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-match-expanded-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <motion.button
          type="button"
          className="route-match-overlay__backdrop"
          aria-label="Close details"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          ref={panelRef}
          tabIndex={-1}
          className="route-match-expanded"
          layoutId={layoutId}
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          <div className="route-match-expanded__header">
            <h2 id="route-match-expanded-title" className="route-match-expanded__title m-0">
              Technician match · {match.techName}
            </h2>
            <button type="button" className="route-match-expanded__close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="route-match-expanded__grid">
            <section className="route-match-expanded__col route-match-expanded__col--summary">
              <RouteMatchCardContent match={match} rank={rank} routeArea={routeArea} compact={false} />
              <div className="route-match-expanded__actions">
                <button type="button" className="route-match-expanded__btn route-match-expanded__btn--primary">
                  Select This Technician
                </button>
                <button type="button" className="route-match-expanded__btn route-match-expanded__btn--ghost">
                  View Full Route
                </button>
              </div>
            </section>

            <section className="route-match-expanded__col route-match-expanded__col--stops">
              <h3 className="route-match-expanded__section-title">Stop sequence</h3>
              <ol className="route-match-stop-list">
                {visibleStops.map(stop => (
                  <li
                    key={stop.id}
                    className={[
                      'route-match-stop-list__item',
                      stop.isNew ? 'route-match-stop-list__item--new' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="route-match-stop-list__time">{stop.scheduledTime || '—'}</span>
                    <div className="min-w-0">
                      <p className="route-match-stop-list__name m-0">
                        {stop.isNew ? 'NEW · ' : ''}{stop.customerName}
                      </p>
                      {stop.address && (
                        <p className="route-match-stop-list__addr m-0">{stop.address}</p>
                      )}
                    </div>
                    {stop.isTimed && <span className="route-match-stop-list__timed">⏱</span>}
                  </li>
                ))}
              </ol>
              {stops.length > 8 && (
                <button
                  type="button"
                  className="route-match-expanded__link-btn"
                  onClick={() => setShowAllStops(v => !v)}
                >
                  {showAllStops ? 'Show fewer stops' : `View all ${stops.length} stops`}
                </button>
              )}

              <h3 className="route-match-expanded__section-title mt-4">Route preview</h3>
              <RouteMatchMapPreview stops={stops} />
            </section>

            <section className="route-match-expanded__col route-match-expanded__col--scores">
              <h3 className="route-match-expanded__section-title">Score breakdown</h3>
              <ul className="route-match-score-list">
                {SCORE_BREAKDOWN.map(({ key, label }) => {
                  const v = match.scores[key] ?? 0;
                  return (
                    <li key={key} className="route-match-score-list__row">
                      <span>{label}</span>
                      <span style={{ color: scoreColor(v) }} className="font-bold">{v}</span>
                    </li>
                  );
                })}
              </ul>

              {day && (
                <>
                  <h3 className="route-match-expanded__section-title mt-4">Day summary</h3>
                  <dl className="route-match-day-summary">
                    <div><dt>Start</dt><dd>{day.startTime || '—'}</dd></div>
                    <div><dt>End</dt><dd>{day.endTime || '—'}</dd></div>
                    <div><dt>Total drive</dt><dd>{day.totalDriveHours ?? '—'}h</dd></div>
                    <div><dt>Total service</dt><dd>{day.totalServiceHours ?? '—'}h</dd></div>
                    <div><dt>Stops</dt><dd>{day.totalStops ?? match.stopCount}</dd></div>
                    <div><dt>Capacity left</dt><dd>{day.capacityLeftHours ?? match.capacity?.remainingHours}h</dd></div>
                  </dl>
                </>
              )}
            </section>
          </div>

          <footer className="route-match-expanded__footer">
            <p className="route-match-expanded__footer-text m-0">
              All metrics indicate this is a strong fit for the selected window and route density.
            </p>
            <button type="button" className="route-match-expanded__btn route-match-expanded__btn--ghost" onClick={onClose}>
              Close
            </button>
          </footer>
        </motion.div>
      </motion.div>,
    document.body,
  );
}
