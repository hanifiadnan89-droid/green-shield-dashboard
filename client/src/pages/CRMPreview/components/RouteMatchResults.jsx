import { useState, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import RouteResultCard from './RouteResultCard.jsx';
import RouteMatchDetailWorkspace from './RouteMatchDetailWorkspace.jsx';
import RouteMatchMapWorkspace from './RouteMatchMapWorkspace.jsx';
import { isGoogleMapsEnabled } from './RouteFinder/useGoogleMapsLoader.js';

/**
 * view: grid | detail | map
 */
export default function RouteMatchResults({ matches, routeArea }) {
  const [view, setView] = useState('grid');
  const [activeRouteId, setActiveRouteId] = useState(null);
  const mapsEnabled = isGoogleMapsEnabled();

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

  const backToDetail = useCallback(() => {
    setView('detail');
  }, []);

  const openFullMap = useCallback(() => {
    if (mapsEnabled) setView('map');
  }, [mapsEnabled]);

  const handleSelectTechnician = useCallback(() => {
    backToGrid();
  }, [backToGrid]);

  return (
    <>
      <div className="route-finder-results-grid">
        {matches.map(match => (
          <RouteResultCard
            key={match.routeId}
            match={match}
            rank={match.rank}
            routeArea={routeArea}
            onSelect={openDetail}
            layout={view === 'grid'}
          />
        ))}
      </div>

      <AnimatePresence>
        {view === 'detail' && activeMatch && (
          <RouteMatchDetailWorkspace
            key={`detail-${activeMatch.routeId}`}
            match={activeMatch}
            rank={activeMatch.rank}
            routeArea={routeArea}
            onBack={backToGrid}
            onSelectTechnician={handleSelectTechnician}
            onOpenFullMap={openFullMap}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mapsEnabled && view === 'map' && activeMatch && (
          <RouteMatchMapWorkspace
            key={`map-${activeMatch.routeId}`}
            match={activeMatch}
            onBack={backToDetail}
          />
        )}
      </AnimatePresence>
    </>
  );
}