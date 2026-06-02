import { useState, useCallback } from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import RouteResultCard from './RouteResultCard.jsx';
import RouteMatchExpandedOverlay from './RouteMatchExpandedOverlay.jsx';

export default function RouteMatchResults({ matches, routeArea }) {
  const [expanded, setExpanded] = useState(null);

  const handleSelect = useCallback((match) => {
    setExpanded({ routeId: match.routeId, rank: match.rank });
  }, []);

  const handleClose = useCallback(() => {
    setExpanded(null);
  }, []);

  const activeMatch = expanded
    ? matches.find(m => m.routeId === expanded.routeId)
    : null;

  return (
    <LayoutGroup>
      <div className="route-finder-results-grid">
        {matches.map(match => {
          if (expanded?.routeId === match.routeId) return null;
          return (
            <RouteResultCard
              key={match.routeId}
              match={match}
              rank={match.rank}
              routeArea={routeArea}
              onSelect={handleSelect}
            />
          );
        })}
      </div>

      <AnimatePresence>
        {activeMatch && (
          <RouteMatchExpandedOverlay
            key={activeMatch.routeId}
            match={activeMatch}
            rank={activeMatch.rank}
            routeArea={routeArea}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
