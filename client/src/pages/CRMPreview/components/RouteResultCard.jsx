import { motion } from 'motion/react';
import RouteMatchCardContent from './RouteMatchCardContent.jsx';
import { matchLayoutId } from './RouteFinder/routeMatchCardConfig.js';

const EASE = [0.22, 1, 0.36, 1];

export default function RouteResultCard({ match, rank, routeArea, onSelect }) {
  const layoutId = matchLayoutId(match);
  const isTop = rank === 1;

  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      onClick={() => onSelect?.(match)}
      className={[
        'route-match-card',
        isTop ? 'route-match-card--top' : '',
        'text-left w-full cursor-pointer',
      ].filter(Boolean).join(' ')}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, ease: EASE }}
      aria-label={`View details for ${match.techName}, rank ${rank}`}
    >
      <RouteMatchCardContent match={match} rank={rank} routeArea={routeArea} compact />
      <p className="route-match-card__hint type-label-sm text-gs-muted m-0 mt-2 text-center">
        Click for full details
      </p>
    </motion.button>
  );
}
