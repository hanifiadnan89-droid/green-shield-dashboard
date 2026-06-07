export function routeMatchKey(match) {
  return match.matchId ?? match.routeId;
}

/**
 * Resolves which match to show in detail view, including pinned fallback after refresh.
 */
export function resolveRouteMatchDetailState({
  view,
  activeMatchKey,
  matches,
  additionalMatches = [],
  showAdditional = false,
  pinnedMatch = null,
}) {
  const allVisible = showAdditional
    ? [...matches, ...additionalMatches]
    : matches;

  const activeMatch = activeMatchKey
    ? allVisible.find(m => routeMatchKey(m) === activeMatchKey)
    : null;

  const detailMatch = activeMatch ?? (view === 'detail' ? pinnedMatch : null);
  const detailStale = view === 'detail' && !activeMatch && Boolean(pinnedMatch);

  return { allVisible, activeMatch, detailMatch, detailStale };
}
