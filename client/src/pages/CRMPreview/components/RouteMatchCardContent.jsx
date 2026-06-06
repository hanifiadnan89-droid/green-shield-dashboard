import ScoreBar from './RouteScoreBar.jsx';
import RouteFinderTrustBadges from './RouteFinder/RouteFinderTrustBadges.jsx';
import RouteFinderCostImpact from './RouteFinder/RouteFinderCostImpact.jsx';
import {
  ROUTE_AREA_LABELS,
  RANK_COLORS,
  TIMED_RISK_CFG,
  SMOOTHNESS_CFG,
  BT_RISK_CFG,
  CONF_CFG,
} from './RouteFinder/routeMatchCardConfig.js';

export default function RouteMatchCardContent({ match, rank, routeArea, multiDay = false, compact = true }) {
  const color = RANK_COLORS[rank - 1] || '#94A3B8';
  const ins = match.bestInsertion;
  const areaLabel = ROUTE_AREA_LABELS[routeArea];
  const smoothCfg = SMOOTHNESS_CFG[match.routeSmoothness] ?? null;
  const timedSafetyColor = ins?.timedRisk === 'high' ? '#DC2626'
    : ins?.timedRisk === 'medium' || ins?.timedRisk === 'low' ? '#F59E0B'
    : '#16A34A';
  const btCfg = BT_RISK_CFG[ins?.backtrackingRisk] ?? BT_RISK_CFG.None;
  const confCfg = CONF_CFG[match.confidenceLabel ?? ins?.optimizationConfidence] ?? CONF_CFG.Low;
  const clusterLabel = match.clusterDetail?.label || match.clusterLabel;

  return (
    <>
      {multiDay && match.dayOfWeekLabel && (
        <p className="rf-match-date-label">{match.dayOfWeekLabel}</p>
      )}

      {rank === 1 && (
        <p className="rf-best-match-label">Best Match</p>
      )}

      {areaLabel && (
        <div className={compact ? 'mb-1.5' : 'mb-2'}>
          <span
            className="route-match-area-badge"
            data-area={routeArea}
          >
            {routeArea === 'new_hampshire' ? 'NH' : 'ME'} · {areaLabel}
          </span>
        </div>
      )}

      <div className={`flex items-center gap-2 ${compact ? 'mb-[5px]' : 'mb-2'}`}>
        <span className="route-match-rank" style={{ background: color }}>{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[5px] mb-px flex-wrap">
            <p className={`font-bold text-gs-text m-0 leading-[1.2] truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {match.techName}
            </p>
            {match.wasOptimized && (
              <span className="route-match-tag route-match-tag--blue">optimized</span>
            )}
            {(match.confidenceLabel || ins?.optimizationConfidence) && (
              <span className="route-match-tag" style={{ color: confCfg.color }}>
                {match.confidenceLabel || ins.optimizationConfidence} conf
              </span>
            )}
          </div>
          <p className="type-label-sm text-gs-muted m-0 font-normal tracking-normal">
            Route {match.routeId} · {match.stopCount} stops · {match.nearestStopMiles} mi away
            {match.clusterDensity > 0 && (
              <span className="font-semibold ml-1 text-gs-accent">
                · {match.clusterDensity} nearby
              </span>
            )}
          </p>
        </div>
        {smoothCfg && (
          <span className="text-[9px] font-bold shrink-0 whitespace-nowrap" style={{ color: smoothCfg.color }}>
            {smoothCfg.icon} {match.routeSmoothness}
          </span>
        )}
      </div>

      {ins?.suggestedWindow && (
        <div className={`rf-recommendation${rank === 1 ? ' rf-recommendation--top' : ''} ${compact ? 'mb-1.5' : 'mb-2'}`}>
          <span className="rf-recommendation__label">
            {rank === 1 ? 'Recommended: ' : 'Suggested: '}
          </span>
          <span className={`rf-recommendation__window ${compact ? 'text-[11px]' : 'text-sm'}`}>
            {ins.suggestedWindow}
          </span>
          <span className="rf-recommendation__arrival">
            (arrives {ins.estimatedArrivalTime})
          </span>
        </div>
      )}

      <ScoreBar score={match.scores.total} />

      <RouteFinderTrustBadges badges={match.trustBadges} compact={compact} />
      <RouteFinderCostImpact costImpact={match.costImpact} compact={compact} />

      {ins && (ins.prevStop || ins.nextStop) && (
        <div className="mt-1.5 type-label-sm text-gs-muted font-normal tracking-normal flex items-center gap-1 flex-wrap">
          {ins.prevStop && (
            <span title={ins.insertAfterLabel || ins.prevStop.scheduledArrival}>{ins.prevStop.customerName}</span>
          )}
          {ins.prevStop && <span className="text-slate-300">→</span>}
          <span className="text-gs-accent font-bold text-[9px] uppercase tracking-[0.05em]">NEW</span>
          {ins.nextStop && <span className="text-slate-300">→</span>}
          {ins.nextStop && (
            <span title={ins.insertBeforeLabel || (ins.nextStop.isTimed ? `Timed: ${ins.nextStop.windowLabel}` : ins.nextStop.scheduledArrival)}>
              {ins.nextStop.customerName}
              {ins.nextStop.isTimed && <span className="text-amber-500 ml-0.5">⏱</span>}
            </span>
          )}
        </div>
      )}

      {ins && (
        <div className="mt-[5px] flex flex-col gap-0.5">
          {ins.insertionPositionLabel && (
            <span className="text-[9px] text-slate-400">
              <span className="font-semibold text-gs-muted">Position</span> {ins.insertionPositionLabel}
            </span>
          )}
          {match.closestStop && (
            <span className="text-[9px] text-slate-400">
              <span className="font-semibold text-gs-muted">Closest stop</span>{' '}
              {match.closestStop.customerName ?? match.closestStop.address} · {match.closestStop.distanceMiles} mi
              {match.closestStop.scheduledTime ? ` · ${match.closestStop.scheduledTime}` : ''}
              {' '}(stop {match.closestStop.stopIndex})
            </span>
          )}
          {clusterLabel && (
            <span
              className="text-[9px] font-semibold"
              style={{ color: match.clusterDensity >= 3 ? '#16A34A' : match.clusterDensity >= 1 ? '#F59E0B' : '#94A3B8' }}
            >
              {match.clusterDensity >= 3 ? '✓ ' : match.clusterDensity >= 1 ? '~ ' : ''}{clusterLabel}
            </span>
          )}
        </div>
      )}

      {ins && (
        <ul className={`route-match-metrics ${compact ? '' : 'route-match-metrics--expanded'}`}>
          <li><span className="text-gs-accent font-semibold">✓</span> +Drive {ins.addedDriveTime}</li>
          <li><span className="text-gs-accent font-semibold">✓</span> Backtracking: {ins.backtrackingRisk === 'None' ? 'None' : ins.backtrackingRisk}</li>
          <li>
            <span style={{ color: timedSafetyColor }} className="font-semibold">
              {ins.timedRisk === 'none' ? '✓' : '⚠'}
            </span>{' '}
            Timed appts: {ins.timedSafetyLabel || 'Safe'}
          </li>
        </ul>
      )}

      {match.reason && (
        <p className={`type-label-sm text-gs-muted font-normal tracking-normal leading-[1.45] ${compact ? 'mt-[5px] mb-0' : 'mt-2 mb-0'}`}>
          {match.reason}
        </p>
      )}

      <div className={`rf-mini-kpis ${compact ? 'mt-1.5' : 'mt-2'}`}>
        {['geographic', 'travelEfficiency', 'timeWindow', 'capacity', 'insertionProximity'].map(k => {
          const labels = { geographic: 'Geo', travelEfficiency: 'Drive', timeWindow: 'Win', capacity: 'Cap', insertionProximity: 'Ins' };
          const v = match.scores[k] ?? 0;
          const tier = v >= 70 ? 'high' : v >= 45 ? 'mid' : 'low';
          return (
            <div key={k} className={`rf-mini-kpi rf-mini-kpi--${tier}`}>
              <div className="rf-mini-kpi__value">{v}</div>
              <div className="rf-mini-kpi__label">{labels[k]}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
