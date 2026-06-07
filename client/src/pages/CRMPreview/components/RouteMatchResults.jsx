import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import RouteResultCard from './RouteResultCard.jsx';
import RouteMatchDetailWorkspace from './RouteMatchDetailWorkspace.jsx';
import { useTechnicianPhotos } from './RouteFinder/useTechnicianPhotos.js';
import { matchLayoutId } from './RouteFinder/routeMatchCardConfig.js';
import {
  routeMatchKey,
  resolveRouteMatchDetailState,
} from './RouteFinder/routeMatchDetailState.js';

const EASE = [0.22, 1, 0.36, 1];
const LAYOUT_TRANSITION = { duration: 0.42, ease: EASE };

/**
 * view: grid | detail
 */
const matchKey = routeMatchKey;

export default function RouteMatchResults({
  matches,
  additionalMatches = [],
  routeArea,
  multiDay = false,
}) {
  const [view, setView] = useState('grid');
  const [activeMatchKey, setActiveMatchKey] = useState(null);
  const [pinnedMatch, setPinnedMatch] = useState(null);
  const [showAdditional, setShowAdditional] = useState(false);
  const { getPhotoUrl } = useTechnicianPhotos();

  const { activeMatch, detailMatch, detailStale } = resolveRouteMatchDetailState({
    view,
    activeMatchKey,
    matches,
    additionalMatches,
    showAdditional,
    pinnedMatch,
  });

  useEffect(() => {
    if (view === 'detail' && activeMatch) {
      setPinnedMatch(activeMatch);
    }
    if (view === 'grid') {
      setPinnedMatch(null);
    }
  }, [view, activeMatch]);

  const openDetail = useCallback((match) => {
    setActiveMatchKey(matchKey(match));
    setView('detail');
  }, []);

  const backToGrid = useCallback(() => {
    setView('grid');
    setActiveMatchKey(null);
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
          const key = matchKey(match);
          const isOpening = view === 'detail' && activeMatchKey === key;
          if (isOpening) return null;

          return (
            <RouteResultCard
              key={key}
              match={match}
              rank={match.rank}
              routeArea={routeArea}
              multiDay={multiDay}
              onSelect={openDetail}
              layout={view === 'grid'}
            />
          );
        })}

        {additionalMatches.length > 0 && (
          <div className="route-finder-more-results">
            <button
              type="button"
              className="route-finder-more-results__toggle"
              onClick={() => setShowAdditional(v => !v)}
            >
              {showAdditional ? (
                <><ChevronUp size={12} /> Hide additional options</>
              ) : (
                <><ChevronDown size={12} /> Show {additionalMatches.length} more option{additionalMatches.length === 1 ? '' : 's'}</>
              )}
            </button>
            {showAdditional && additionalMatches.map(match => {
              const key = matchKey(match);
              const isOpening = view === 'detail' && activeMatchKey === key;
              if (isOpening) return null;
              return (
                <RouteResultCard
                  key={key}
                  match={match}
                  rank={match.rank}
                  routeArea={routeArea}
                  multiDay={multiDay}
                  onSelect={openDetail}
                  layout={view === 'grid'}
                />
              );
            })}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {view === 'detail' && detailMatch && (
          <RouteMatchDetailWorkspace
            key={`detail-${matchKey(detailMatch)}`}
            layoutId={matchLayoutId(detailMatch)}
            match={detailMatch}
            rank={detailMatch.rank}
            routeArea={routeArea}
            multiDay={multiDay}
            photoUrl={getPhotoUrl(detailMatch.techName)}
            detailStale={detailStale}
            onBack={backToGrid}
            onSelectTechnician={handleSelectTechnician}
            layoutTransition={LAYOUT_TRANSITION}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
