import { useState, useCallback } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import RouteResultCard from './RouteResultCard.jsx';
import RouteMatchDetailWorkspace from './RouteMatchDetailWorkspace.jsx';
import { useTechnicianPhotos } from './RouteFinder/useTechnicianPhotos.js';
import { matchLayoutId } from './RouteFinder/routeMatchCardConfig.js';

const EASE = [0.22, 1, 0.36, 1];
const LAYOUT_TRANSITION = { duration: 0.42, ease: EASE };

/**
 * view: grid | detail
 */
export default function RouteMatchResults({ matches, routeArea }) {
  const [view, setView] = useState('grid');
  const [activeRouteId, setActiveRouteId] = useState(null);
  const { getPhotoUrl } = useTechnicianPhotos();

  const activeMatch = activeRouteId
    ? matches.find(m => m.routeId === activeRouteId)
    : null;

  const openDetail = useCallback((match) => {
    setActiveRouteId(match.routeId);
    setView('detail');
  }, []);

  const backToGrid = useCallback(() => {
    setView('grid');
    setActiveRouteId(null);
  }, []);

  const handleSelectTechnician = useCallback(() => {
    backToGrid();
  }, [backToGrid]);

  const gridDimmed = view === 'detail';

  return (
    <LayoutGroup id="route-match-results">
      <motion.div
        className="route-finder-results-grid"
        layout
        animate={{
          opacity: gridDimmed ? 0.45 : 1,
          scale: gridDimmed ? 0.985 : 1,
        }}
        transition={{ duration: 0.38, ease: EASE }}
        aria-hidden={gridDimmed}
      >
        {matches.map(match => {
          const isOpening = view === 'detail' && activeRouteId === match.routeId;
          if (isOpening) return null;

          return (
            <RouteResultCard
              key={match.routeId}
              match={match}
              rank={match.rank}
              routeArea={routeArea}
              onSelect={openDetail}
              layout={view === 'grid'}
            />
          );
        })}
      </motion.div>

      <AnimatePresence>
        {view === 'detail' && activeMatch && (
          <RouteMatchDetailWorkspace
            key={`detail-${activeMatch.routeId}`}
            layoutId={matchLayoutId(activeMatch)}
            match={activeMatch}
            rank={activeMatch.rank}
            routeArea={routeArea}
            photoUrl={getPhotoUrl(activeMatch.techName)}
            onBack={backToGrid}
            onSelectTechnician={handleSelectTechnician}
            layoutTransition={LAYOUT_TRANSITION}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
