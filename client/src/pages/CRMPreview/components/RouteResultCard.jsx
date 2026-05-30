// ---------------------------------------------------------------------------
// Result card — extracted from RouteFinderWidget.jsx (Phase 11 step 1)
// ---------------------------------------------------------------------------
import ScoreBar from './RouteScoreBar.jsx';

const ROUTE_AREA_LABELS = {
  new_hampshire: 'New Hampshire Route',
  maine:         'Maine Route',
};

const TIMED_RISK_CFG = {
  none:   { label: '✓ timed safe',    color: '#16A34A' },
  low:    { label: '⚡ low risk',      color: '#F59E0B' },
  medium: { label: '⚠ timed risk',    color: '#F59E0B' },
  high:   { label: '✗ timed conflict', color: '#DC2626' },
};

const SMOOTHNESS_CFG = {
  'Smooth fit':       { color: '#16A34A', icon: '✓' },
  'Minor adjustment': { color: '#F59E0B', icon: '~' },
  'Tight gap':        { color: '#F59E0B', icon: '⚡' },
  'Some disruption':  { color: '#F59E0B', icon: '⚠' },
  'Difficult fit':    { color: '#DC2626', icon: '✗' },
};

const BT_RISK_CFG = {
  'None':     { color: '#16A34A', icon: '✓' },
  'Low':      { color: '#F59E0B', icon: '~' },
  'Moderate': { color: '#F59E0B', icon: '⚠' },
  'High':     { color: '#DC2626', icon: '✗' },
  'Severe':   { color: '#DC2626', icon: '✗' },
};

const CONF_CFG = {
  'High':   { color: '#16A34A' },
  'Medium': { color: '#F59E0B' },
  'Low':    { color: '#94A3B8' },
};

function ResultCard({ match, rank, routeArea }) {
  const rankColors = ['#16A34A', '#3B82F6', '#8B5CF6'];
  const color = rankColors[rank - 1] || '#94A3B8';
  const ins = match.bestInsertion;
  const timedCfg = TIMED_RISK_CFG[ins?.timedRisk] ?? TIMED_RISK_CFG.none;
  const areaLabel = ROUTE_AREA_LABELS[routeArea];
  const smoothCfg = SMOOTHNESS_CFG[match.routeSmoothness] ?? null;
  const timedSafetyColor = ins?.timedRisk === 'high' ? '#DC2626'
    : ins?.timedRisk === 'medium' || ins?.timedRisk === 'low' ? '#F59E0B'
    : '#16A34A';
  const btCfg   = BT_RISK_CFG[ins?.backtrackingRisk] ?? BT_RISK_CFG['None'];
  const confCfg = CONF_CFG[ins?.optimizationConfidence] ?? CONF_CFG['Low'];
  const clusterLabel = match.clusterDetail?.label || match.clusterLabel;

  return (
    <div
      className="rounded-[10px] px-3 py-2.5 mb-2"
      style={{
        border: `1px solid ${rank === 1 ? 'rgba(22,163,74,0.25)' : 'rgba(0,0,0,0.07)'}`,
        background: rank === 1 ? 'rgba(22,163,74,0.04)' : '#fff',
      }}
    >
      {/* Route area badge */}
      {areaLabel && (
        <div className="mb-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-[0.04em] rounded px-[5px] py-px"
            style={{
              color: routeArea === 'new_hampshire' ? '#3B82F6' : '#8B5CF6',
              background: routeArea === 'new_hampshire' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)',
            }}
          >
            Route Area: {areaLabel}
          </span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-2 mb-[5px]">
        <span
          className="w-5 h-5 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center shrink-0"
          style={{ background: color }}
        >
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[5px] mb-px">
            <p className="text-xs font-bold text-gs-text m-0 leading-[1.2] truncate">
              {match.techName}
            </p>
            {match.wasOptimized && (
              <span className="text-[8px] font-bold text-blue-500 bg-blue-500/[0.08] rounded-[3px] px-1 py-px whitespace-nowrap shrink-0">
                optimized
              </span>
            )}
            {ins?.optimizationConfidence && (
              <span
                className="text-[8px] font-semibold shrink-0"
                style={{ color: confCfg.color }}
                title={`Optimization confidence: ${ins.optimizationConfidence}`}
              >
                {ins.optimizationConfidence} conf
              </span>
            )}
          </div>
          <p className="type-label-sm text-gs-muted m-0 font-normal tracking-normal">
            Route {match.routeId} · {match.stopCount} stops · {match.nearestStopMiles} mi away
            {match.clusterDensity > 0 && (
              <span className="font-semibold ml-1" style={{ color: '#16A34A' }}>
                · {match.clusterDensity} nearby
              </span>
            )}
          </p>
        </div>
        {smoothCfg && (
          <span
            className="text-[9px] font-bold shrink-0 whitespace-nowrap"
            style={{ color: smoothCfg.color }}
          >
            {smoothCfg.icon} {match.routeSmoothness}
          </span>
        )}
      </div>

      {/* Suggested window */}
      {ins?.suggestedWindow && (
        <div className="mb-1.5">
          <span
            className="type-label-sm uppercase tracking-[0.05em] font-bold"
            style={{ color: rank === 1 ? '#16A34A' : '#64748B' }}
          >
            {rank === 1 ? 'Recommended: ' : 'Suggested: '}
          </span>
          <span className="text-[11px] font-bold text-gs-text">
            {ins.suggestedWindow}
          </span>
          <span className="type-label-sm text-slate-400 ml-[5px] font-normal tracking-normal">
            (arrives {ins.estimatedArrivalTime})
          </span>
        </div>
      )}

      <ScoreBar score={match.scores.total} />

      {/* Insertion path */}
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

      {/* Geo context: insertion position + closest stop + cluster */}
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

      {/* Stats row */}
      {ins && (
        <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
          <span className="type-label-sm text-slate-600 font-normal tracking-normal">
            <span className="font-semibold">+Drive</span> {ins.addedDriveTime}
          </span>
          <span className="type-label-sm text-slate-600 font-normal tracking-normal">
            <span className="font-semibold">+Miles</span> {ins.detourMiles} mi
          </span>
          {ins.serviceDuration && (
            <span className="type-label-sm text-slate-600 font-normal tracking-normal">
              <span className="font-semibold">Service</span> {ins.serviceDuration}
            </span>
          )}
          <span className="type-label-sm text-slate-600 font-normal tracking-normal">
            <span className="font-semibold">Cap</span> {match.capacity.remainingHours}h left
          </span>
          {!ins.viable && (
            <span className="type-label-sm text-amber-500 font-semibold tracking-normal">⚠ tight gap</span>
          )}
        </div>
      )}

      {/* Backtracking risk */}
      {ins?.backtrackingRisk && ins.backtrackingRisk !== 'None' && (
        <div className="mt-1">
          <span className="type-label-sm font-semibold tracking-normal" style={{ color: btCfg.color }}>
            {btCfg.icon} Backtracking:
          </span>{' '}
          <span className="type-label-sm tracking-normal" style={{ color: btCfg.color }}>
            {ins.backtrackingRisk}
            {ins.backtrackingDetail ? ` — ${ins.backtrackingDetail}` : ''}
          </span>
        </div>
      )}
      {ins?.backtrackingRisk === 'None' && (
        <div className="mt-1">
          <span className="type-label-sm font-semibold text-gs-accent tracking-normal">✓ Backtracking:</span>{' '}
          <span className="type-label-sm text-gs-accent tracking-normal">None</span>
        </div>
      )}

      {/* Timed appointment safety */}
      {ins?.timedSafetyLabel && (
        <div className="mt-0.5">
          <span className="type-label-sm font-semibold tracking-normal" style={{ color: timedSafetyColor }}>
            {ins.timedRisk === 'none' ? '✓' : ins.timedRisk === 'high' ? '✗' : '⚠'} Timed appts:
          </span>{' '}
          <span className="type-label-sm tracking-normal" style={{ color: timedSafetyColor }}>{ins.timedSafetyLabel}</span>
        </div>
      )}

      {/* Estimated end of day — informational */}
      {ins?.eodLabel && (
        <div className="mt-0.5">
          <span className="type-label-sm font-semibold text-gs-muted tracking-normal">◷ Est. end:</span>{' '}
          <span className="type-label-sm text-slate-600 tracking-normal">{ins.eodLabel}</span>
        </div>
      )}

      {/* Start/end location fit */}
      {ins?.startEndLocationFit && !ins.startEndLocationFit.startsWith('Neutral') && (
        <div className="mt-0.5">
          <span className="type-label-sm font-semibold text-blue-500 tracking-normal">◎ Location fit:</span>{' '}
          <span className="type-label-sm text-slate-600 tracking-normal">{ins.startEndLocationFit}</span>
        </div>
      )}

      {/* Reason */}
      {match.reason && (
        <p className="type-label-sm text-gs-muted font-normal tracking-normal mt-[5px] mb-0 leading-[1.4]">
          {match.reason}
        </p>
      )}

      {/* Score breakdown */}
      <div className="flex gap-1.5 mt-1.5 pt-[5px] border-t border-black/[0.04]">
        {['geographic', 'travelEfficiency', 'timeWindow', 'capacity', 'insertionProximity'].map(k => {
          const labels = { geographic: 'Geo', travelEfficiency: 'Drive', timeWindow: 'Win', capacity: 'Cap', insertionProximity: 'Ins' };
          const v = match.scores[k] ?? 0;
          return (
            <div key={k} className="text-center flex-1">
              <div
                className="type-label-sm font-bold tracking-normal"
                style={{ color: v >= 70 ? '#16A34A' : v >= 45 ? '#F59E0B' : '#CBD5E1' }}
              >
                {v}
              </div>
              <div className="text-[9px] text-slate-400 mt-px">{labels[k]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ResultCard;
