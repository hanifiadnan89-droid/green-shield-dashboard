/**
 * Staged Route Finder scoring: haversine prefilter → road timing for top candidates only.
 */

import { scoreRoutesAsync } from './fieldRoutesScorer.js';
import { prefetchTravelContext } from './routeTravelContext.js';
import { getRoutesApiConfig, createSearchElementBudget } from './routesApiConfig.js';

function techByRouteId(technicians, routeId) {
  return technicians.find(t => String(t.routeId) === String(routeId)) ?? null;
}

/**
 * Score technicians with haversine first, then road-time the top prefilter routes within budget.
 */
export async function stagedScoreRoutes(technicians, lead, topN = 3, options = {}) {
  const config = getRoutesApiConfig();

  if (!config.enableRoadTiming || options.prefetchTravel === false) {
    return {
      result: await scoreRoutesAsync(technicians, lead, topN, { ...options, prefetchTravel: false, travelCtx: null }),
      travelCtx: null,
      stagingDiagnostics: {
        roadTimingUsed: false,
        routesRoadScored: 0,
        routesEstimatedOnly: technicians.length,
      },
    };
  }

  const haversineResult = await scoreRoutesAsync(technicians, lead, technicians.length, {
    ...options,
    prefetchTravel: false,
    travelCtx: null,
  });

  if (haversineResult.noSafeRoute) {
    return {
      result: haversineResult,
      travelCtx: null,
      stagingDiagnostics: {
        roadTimingUsed: false,
        routesRoadScored: 0,
        routesEstimatedOnly: technicians.length,
      },
    };
  }

  const ranked = haversineResult.topMatches ?? [];
  const prefilterCount = Math.min(config.prefilterTopRoutes, ranked.length);
  const topRouteIds = ranked.slice(0, prefilterCount).map(m => m.routeId);
  const topTechs = topRouteIds
    .map(id => techByRouteId(technicians, id))
    .filter(Boolean);

  const budget = options.budget || createSearchElementBudget(config);
  budget.routesRoadScored = topTechs.length;
  budget.routesEstimatedOnly = Math.max(0, technicians.length - topTechs.length);

  let travelCtx = null;
  if (topTechs.length > 0 && budget.remainingSearchElements > 0) {
    travelCtx = await prefetchTravelContext(topTechs, lead, {
      ...options,
      budget,
      targetedOnly: true,
    });
  }

  const roadResult = topTechs.length > 0
    ? await scoreRoutesAsync(topTechs, lead, topN, {
      ...options,
      prefetchTravel: false,
      travelCtx,
    })
    : haversineResult;

  const topMatches = [...(roadResult.topMatches ?? [])];
  if (topMatches.length < topN) {
    const seen = new Set(topMatches.map(m => m.routeId));
    for (const m of ranked) {
      if (topMatches.length >= topN) break;
      if (!seen.has(m.routeId)) {
        topMatches.push(m);
        seen.add(m.routeId);
      }
    }
  }

  const stagingDiagnostics = {
    roadTimingUsed: Boolean(travelCtx?.travelDiagnostics?.roadTimingUsed),
    fallbackUsed: Boolean(travelCtx?.travelDiagnostics?.fallbackUsed),
    fallbackReason: travelCtx?.travelDiagnostics?.fallbackReason ?? null,
    elementsRequested: travelCtx?.travelDiagnostics?.elementsRequested ?? 0,
    elementsFromCache: travelCtx?.travelDiagnostics?.elementsFromCache ?? 0,
    elementsBudgetRemaining: travelCtx?.travelDiagnostics?.elementsBudgetRemaining ?? budget.remainingSearchElements,
    routesRoadScored: topTechs.length,
    routesEstimatedOnly: Math.max(0, technicians.length - topTechs.length),
    prefilterTopRoutes: config.prefilterTopRoutes,
  };

  return {
    result: {
      ...roadResult,
      topMatches: topMatches.slice(0, topN),
    },
    travelCtx,
    stagingDiagnostics,
  };
}
