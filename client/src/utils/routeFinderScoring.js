/**
 * Route Finder scoring orchestration — single-date and best-available modes.
 */

import { scoreRoutesAsync, detectRouteArea } from './fieldRoutesScorer.js';
import { getRoutesApiConfig, createSearchElementBudget } from './routesApiConfig.js';
import { stagedScoreRoutes } from './stagedRouteScoring.js';

function buildPrefWindowMeta(lead) {
  const pref = lead?.timeWindowPreference || 'AT';
  const fmt = (min) => {
    if (min == null) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
  };
  const windows = {
    AM: { start: 480, end: 720 },
    PM: { start: 720, end: 1080 },
    AT: { start: 480, end: 1080 },
  };
  const w = windows[pref] ?? windows.AT;
  return { label: pref, startTime: fmt(w.start), endTime: fmt(w.end) };
}
import { enrichMatchWithTrustAndCost } from './routeTrustWarnings.js';
import { defaultTravelProvider } from './routeTravelTimeProvider.js';
import { buildRouteFinderLead } from '../pages/CRMPreview/components/RouteFinder/routeServiceTypes.js';

export const SCORING_MODES = {
  SINGLE_DATE: 'single-date',
  BEST_AVAILABLE: 'best-available',
};

const SKIPPABLE_DATE_STATUSES = new Set(['missing', 'failed', 'needs_login', 'not_configured', 'refreshing']);

/**
 * @param {string} dateKey YYYY-MM-DD
 */
export function formatRouteDateLabel(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatDayOfWeek(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function techByRouteId(technicians, routeId) {
  return technicians?.find(t => String(t.routeId) === String(routeId)) ?? null;
}

function travelProviderFromMatch(match) {
  return {
    getProviderName: () => match.travelProvider || defaultTravelProvider.getProviderName(),
    getProviderAccuracy: () => match.travelAccuracy || defaultTravelProvider.getProviderAccuracy(),
  };
}

function attachMatchMeta(match, { date, technicians, lead, rank, travelDiagnostics }) {
  const tech = techByRouteId(technicians, match.routeId);
  const diagnostics = travelDiagnostics
    ? { ...match.travelDiagnostics, ...travelDiagnostics }
    : (match.travelDiagnostics || null);
  const enriched = enrichMatchWithTrustAndCost(match, lead, {
    tech,
    travelProvider: travelProviderFromMatch(match),
    travelDiagnostics: diagnostics,
  });

  const matchId = `${date}::${match.routeId}`;
  return {
    ...enriched,
    matchId,
    routeDate: date,
    dayOfWeek: formatDayOfWeek(date),
    dayOfWeekLabel: formatRouteDateLabel(date),
    rank,
    travelDiagnostics: diagnostics,
  };
}

function enrichSingleDateResult(result, technicians, lead, travelCtx) {
  const diagnostics = travelCtx?.travelDiagnostics || null;
  const provider = diagnostics?.travelProvider || travelCtx?.getProviderName?.() || defaultTravelProvider.getProviderName();
  if (!result || result.noSafeRoute) {
    return {
      ...result,
      mode: SCORING_MODES.SINGLE_DATE,
      generatedAt: new Date().toISOString(),
      travelProvider: provider,
      travelDiagnostics: diagnostics,
    };
  }

  const topMatches = (result.topMatches ?? []).map((m, i) =>
    attachMatchMeta(m, {
      date: lead.date,
      technicians,
      lead,
      rank: i + 1,
      travelDiagnostics: m.travelDiagnostics || diagnostics,
    }),
  );

  return {
    ...result,
    mode: SCORING_MODES.SINGLE_DATE,
    generatedAt: new Date().toISOString(),
    travelProvider: provider,
    travelDiagnostics: diagnostics,
    travelAccuracy: diagnostics?.travelAccuracy || (provider === 'google-routes' ? 'road-based' : 'estimated'),
    topMatches,
    recommendation: topMatches[0] ?? null,
    alternatives: topMatches.slice(1),
  };
}

/**
 * Score one date (existing behavior + enrichment).
 */
export async function scoreSingleDate(technicians, lead, topN = 3, options = {}) {
  let travelCtx = options.travelCtx ?? null;
  let raw;
  let stagingDiagnostics = null;

  if (travelCtx) {
    raw = await scoreRoutesAsync(technicians, lead, topN, { ...options, travelCtx, prefetchTravel: false });
  } else if (options.prefetchTravel === false) {
    raw = await scoreRoutesAsync(technicians, lead, topN, { ...options, prefetchTravel: false });
  } else {
    const staged = await stagedScoreRoutes(technicians, lead, topN, options);
    raw = staged.result;
    travelCtx = staged.travelCtx;
    stagingDiagnostics = staged.stagingDiagnostics;
  }

  const enriched = enrichSingleDateResult(raw, technicians, lead, travelCtx);
  if (stagingDiagnostics) {
    enriched.stagingDiagnostics = stagingDiagnostics;
    enriched.travelDiagnostics = {
      ...(enriched.travelDiagnostics || {}),
      ...stagingDiagnostics,
    };
  }
  return enriched;
}

/**
 * Score all cached available dates and rank globally.
 *
 * @param {Object} params
 * @param {Object} params.leadBase - Lead without date
 * @param {Array<{ key: string, label: string }>} params.dateMetas
 * @param {Record<string, { status: string }>} params.dateStatus
 * @param {(date: string) => Promise<{ technicians: unknown[] }>} params.fetchPayload
 * @param {number} [params.topN=3]
 * @param {number} [params.maxExtra=5] - Additional collapsible results beyond top 3
 */
export async function scoreBestAvailable({
  leadBase,
  dateMetas,
  dateStatus,
  fetchPayload,
  topN = 3,
  maxExtra = 5,
  prefetchTravel = true,
}) {
  const config = getRoutesApiConfig();
  const searchBudget = createSearchElementBudget(config);
  const allMatches = [];
  const skippedDates = [];
  let datesScored = 0;
  let lastTravelDiagnostics = null;
  const dateCandidates = [];

  for (const { key: date } of dateMetas) {
    const status = dateStatus[date]?.status;
    if (!status || SKIPPABLE_DATE_STATUSES.has(status)) {
      skippedDates.push({ date, reason: status || 'missing' });
      continue;
    }

    let technicians;
    try {
      const payload = await fetchPayload(date);
      technicians = payload?.technicians ?? [];
    } catch {
      skippedDates.push({ date, reason: 'payload_error' });
      continue;
    }

    if (!technicians.length) {
      skippedDates.push({ date, reason: 'no_routes' });
      continue;
    }

    const lead = { ...leadBase, date };
    const haversineResult = await scoreRoutesAsync(technicians, lead, technicians.length, {
      prefetchTravel: false,
      travelCtx: null,
    });
    datesScored += 1;

    if (haversineResult.noSafeRoute) continue;

    for (const match of haversineResult.topMatches ?? []) {
      dateCandidates.push({
        date,
        technicians,
        lead,
        match,
        estimatedScore: match.scores?.total ?? 0,
      });
    }
  }

  dateCandidates.sort((a, b) => b.estimatedScore - a.estimatedScore);

  const prefilterCount = Math.min(config.prefilterTopRoutes, dateCandidates.length);
  const roadCandidates = prefetchTravel && searchBudget.remainingSearchElements > 0
    ? dateCandidates.slice(0, prefilterCount)
    : [];

  const roadScoredKeys = new Set();

  for (const candidate of roadCandidates) {
    if (searchBudget.remainingSearchElements <= 0) break;

    const { date, technicians, lead, match } = candidate;
    const tech = technicians.find(t => String(t.routeId) === String(match.routeId));
    if (!tech) continue;

    const staged = await stagedScoreRoutes([tech], lead, 1, {
      budget: searchBudget,
      prefetchTravel: true,
    });

    roadScoredKeys.add(`${date}::${match.routeId}`);
    const roadMatch = staged.result.topMatches?.[0] ?? match;
    const diagnostics = staged.travelCtx?.travelDiagnostics || staged.stagingDiagnostics;

    allMatches.push(
      attachMatchMeta(roadMatch, {
        date,
        technicians,
        lead,
        rank: 0,
        travelDiagnostics: diagnostics,
      }),
    );

    if (diagnostics) lastTravelDiagnostics = diagnostics;
  }

  for (const candidate of dateCandidates) {
    const key = `${candidate.date}::${candidate.match.routeId}`;
    if (roadScoredKeys.has(key)) continue;

    allMatches.push(
      attachMatchMeta(candidate.match, {
        date: candidate.date,
        technicians: candidate.technicians,
        lead: candidate.lead,
        rank: 0,
        travelDiagnostics: {
          travelProvider: 'haversine',
          travelAccuracy: 'estimated',
          roadTimingUsed: false,
          fallbackUsed: true,
          fallbackReason: roadScoredKeys.size > 0
            ? 'Road timing skipped to control API usage; estimated timing used.'
            : 'estimated_prefilter',
          routesEstimatedOnly: 1,
        },
      }),
    );
  }

  allMatches.sort((a, b) => (b.scores?.total ?? 0) - (a.scores?.total ?? 0));
  allMatches.forEach((m, i) => { m.rank = i + 1; });

  const topMatches = allMatches.slice(0, topN);
  const additionalMatches = allMatches.slice(topN, topN + maxExtra);

  return {
    mode: SCORING_MODES.BEST_AVAILABLE,
    generatedAt: new Date().toISOString(),
    travelProvider: lastTravelDiagnostics?.travelProvider || defaultTravelProvider.getProviderName(),
    travelDiagnostics: lastTravelDiagnostics,
    travelAccuracy: lastTravelDiagnostics?.travelAccuracy || 'estimated',
    routeArea: leadBase.routeArea,
    prefWindow: buildPrefWindowMeta(leadBase),
    lead: leadBase,
    totalRoutesScored: allMatches.length,
    datesScored,
    skippedDates,
    noSafeRoute: allMatches.length === 0,
    noSafeRouteMessage: allMatches.length === 0
      ? 'No viable routes found across cached dates. Try refreshing route data or adjusting the address or service type.'
      : null,
    topMatches,
    additionalMatches,
    recommendation: topMatches[0] ?? null,
    alternatives: topMatches.slice(1),
  };
}

export { buildRouteFinderLead, detectRouteArea };
