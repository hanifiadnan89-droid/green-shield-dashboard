import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Maximize2, X } from 'lucide-react';
import RouteMatchCardContent from './RouteMatchCardContent.jsx';
import RouteMatchScoreBreakdown from './RouteMatchScoreBreakdown.jsx';
import RouteGoogleMap from './RouteGoogleMap.jsx';
import RouteMatchMapWorkspace from './RouteMatchMapWorkspace.jsx';
import TechnicianPhoto from './TechnicianPhoto.jsx';
import { useRouteMatchPortalRoot } from './RouteFinder/useRouteMatchPortalRoot.js';
import { getMapCoordinateStatus } from './RouteFinder/routeMapStops.js';
import { useRoadPolyline } from './RouteFinder/useRoadPolyline.js';
import { DETAIL_SCORE_BREAKDOWN } from './RouteFinder/routeMatchCardConfig.js';

const EASE = [0.22, 1, 0.36, 1];

export default function RouteMatchDetailWorkspace({
  layoutId,
  match,
  rank,
  routeArea,
  multiDay = false,
  photoUrl,
  onBack,
  onSelectTechnician,
  layoutTransition = { duration: 0.42, ease: EASE },
}) {
  const panelRef = useRef(null);
  const portalRoot = useRouteMatchPortalRoot();
  const [showAllStops, setShowAllStops] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const stops = match.routeStops || [];
  const visibleStops = showAllStops ? stops : stops.slice(0, 12);
  const day = match.daySummary;
  const mapCoordStatus = getMapCoordinateStatus(stops);
  const roadPolyline = useRoadPolyline({
    stops,
    routeId: match.routeId,
    routeDate: match.routeDate,
    enabled: true,
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (mapExpanded) {
        setMapExpanded(false);
        return;
      }
      onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, mapExpanded]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const workspace = (
    <motion.div
      className="crm-preview route-match-workspace"
      role="dialog"
      aria-modal="true"
      aria-labelledby="route-match-detail-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26, ease: EASE }}
    >
      <motion.button
        type="button"
        className="route-match-workspace__backdrop-top"
        aria-label="Close technician details"
        onClick={onBack}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
      />

      <div className="route-match-detail">
        <motion.div
          ref={panelRef}
          tabIndex={-1}
          layoutId={layoutId}
          layout
          className="route-match-detail__surface"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{
            layout: layoutTransition,
            opacity: { duration: 0.28, ease: EASE },
            x: { duration: 0.28, ease: EASE },
          }}
        >
        <header className="route-match-detail__header">
          <button type="button" className="route-match-detail__back" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden />
            Back to Matches
          </button>
          <h1 id="route-match-detail-title" className="route-match-detail__title m-0">
            Technician match · {match.techName}
          </h1>
          <button
            type="button"
            className="route-match-detail__close"
            onClick={onBack}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </header>

        <motion.div
          className="route-match-detail__grid"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE, delay: 0.1 }}
        >
          <section className="route-match-detail__col route-match-detail__col--summary">
            <div className="route-match-detail__hero">
              <TechnicianPhoto
                techName={match.techName}
                photoUrl={photoUrl}
                size="detail"
                className="route-match-detail__photo"
              />
              <div className="route-match-detail__hero-meta">
                <p className="route-match-detail__hero-rank m-0">Rank #{rank}</p>
                <p className="route-match-detail__hero-name m-0">{match.techName}</p>
              </div>
            </div>
            <RouteMatchCardContent
              match={match}
              rank={rank}
              routeArea={routeArea}
              multiDay={multiDay}
              compact={false}
              showCostImpact={false}
              showTravelAccuracy={false}
            />

            {match.trustWarnings?.length > 0 && (
              <div className="rf-detail-warnings">
                <h2 className="route-match-detail__section-title">Reliability notes</h2>
                <ul className="rf-detail-warnings__list">
                  {match.trustWarnings.map(w => (
                    <li key={w.code} className={`rf-detail-warnings__item rf-detail-warnings__item--${w.severity}`}>
                      <strong>{w.badge}</strong>
                      <span>{w.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="route-match-detail__actions">
              <button
                type="button"
                className="route-match-detail__btn route-match-detail__btn--primary"
                onClick={onSelectTechnician}
              >
                Select Technician
              </button>
            </div>
          </section>

          <section className="route-match-detail__col route-match-detail__col--stops">
            <div className="route-match-detail__stops-panel">
              <h2 className="route-match-detail__section-title route-match-detail__section-title--stops">
                Stop sequence ({stops.length} stops)
              </h2>
              <div
                className="route-match-detail__stops-scroll"
                role="region"
                aria-label={`Stop sequence, ${stops.length} stops`}
                tabIndex={0}
              >
                <ol className="route-match-stop-list route-match-stop-list--detail">
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
              </div>
              {stops.length > 12 && (
                <button
                  type="button"
                  className="route-match-expanded__link-btn route-match-detail__stops-toggle"
                  onClick={() => setShowAllStops(v => !v)}
                >
                  {showAllStops ? 'Show fewer stops' : `View all ${stops.length} stops`}
                </button>
              )}
            </div>
          </section>

          <section className="route-match-detail__col route-match-detail__col--analytics">
            <h2 className="route-match-detail__section-title">Score breakdown</h2>
            <RouteMatchScoreBreakdown scores={match.scores} rows={DETAIL_SCORE_BREAKDOWN} />

            {day && (
              <>
                <h2 className="route-match-detail__section-title mt-4">Day summary</h2>
                <dl className="route-match-day-summary route-match-day-summary--detail">
                  <div><dt>Start</dt><dd>{day.startTime || '—'}</dd></div>
                  <div><dt>End</dt><dd>{day.endTime || '—'}</dd></div>
                  <div><dt>Workload</dt><dd>{match.routeFeasibility?.workloadLabelDisplay || day.workloadLabel || '—'}</dd></div>
                  <div><dt>Existing service</dt><dd>{match.routeFeasibility?.currentServiceMinutes ? `${Math.round(match.routeFeasibility.currentServiceMinutes / 60 * 10) / 10}h` : '—'}</dd></div>
                  <div><dt>Existing drive</dt><dd>{match.routeFeasibility?.currentDriveMinutes != null ? `${Math.round(match.routeFeasibility.currentDriveMinutes)} min` : '—'}</dd></div>
                  <div><dt>New appointment</dt><dd>{match.bestInsertion?.serviceDuration || '—'}</dd></div>
                  <div><dt>Added drive</dt><dd>{match.bestInsertion?.addedDriveTime || '—'}{match.bestInsertion?.addedMileage ? ` / ${match.bestInsertion.addedMileage}` : ''}</dd></div>
                  <div><dt>Projected total</dt><dd>{match.routeFeasibility?.projectedTotalRouteMinutes ? `${Math.round(match.routeFeasibility.projectedTotalRouteMinutes / 60 * 10) / 10}h` : '—'}</dd></div>
                  <div><dt>Total drive</dt><dd>{day.totalDriveHours ?? '—'}h</dd></div>
                  <div><dt>Total service</dt><dd>{day.totalServiceHours ?? '—'}h</dd></div>
                  <div><dt>Stops</dt><dd>{day.totalStops ?? match.stopCount}</dd></div>
                  <div><dt>Capacity left</dt><dd>{day.capacityLeftHours ?? match.capacity?.remainingHours}h</dd></div>
                </dl>
              </>
            )}

            <div className="route-match-detail__map-section">
              <div className="route-match-detail__map-header">
                <h2 className="route-match-detail__section-title mt-4 m-0">Route preview</h2>
                {mapCoordStatus.withCoords > 0 && (
                  <button
                    type="button"
                    className="route-match-detail__map-fullview-btn"
                    onClick={() => setMapExpanded(true)}
                    title="Full View"
                    aria-label="Full View"
                  >
                    <Maximize2 size={14} aria-hidden />
                    <span>Full View</span>
                  </button>
                )}
              </div>
              {mapCoordStatus.total > 0 && mapCoordStatus.withCoords === 0 && (
                <p className="route-match-detail__map-hint type-label-sm m-0 mb-2">
                  Map unavailable: none of the {mapCoordStatus.total} stops have coordinates.
                </p>
              )}
              <RouteGoogleMap
                stops={stops}
                mapType="satellite"
                compact
                detailView
                showControls
                interactive
                roadPolyline={roadPolyline}
              />
            </div>
          </section>
        </motion.div>
        </motion.div>
      </div>

      {mapExpanded && (
        <RouteMatchMapWorkspace
          match={match}
          roadPolyline={roadPolyline}
          onBack={() => setMapExpanded(false)}
          inline
        />
      )}
    </motion.div>
  );

  return portalRoot ? createPortal(workspace, portalRoot) : workspace;
}
