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
    <div style={{
      borderRadius: 10,
      border: `1px solid ${rank === 1 ? 'rgba(22,163,74,0.25)' : 'rgba(0,0,0,0.07)'}`,
      background: rank === 1 ? 'rgba(22,163,74,0.04)' : '#fff',
      padding: '10px 12px',
      marginBottom: 8,
    }}>
      {/* Route area badge */}
      {areaLabel && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            color: routeArea === 'new_hampshire' ? '#3B82F6' : '#8B5CF6',
            background: routeArea === 'new_hampshire' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)',
            borderRadius: 4, padding: '1px 5px',
          }}>
            Route Area: {areaLabel}
          </span>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%', background: color,
          color: '#fff', fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {rank}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {match.techName}
            </p>
            {match.wasOptimized && (
              <span style={{ fontSize: 8, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.08)', borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                optimized
              </span>
            )}
            {ins?.optimizationConfidence && (
              <span style={{ fontSize: 8, fontWeight: 600, color: confCfg.color, flexShrink: 0 }}
                    title={`Optimization confidence: ${ins.optimizationConfidence}`}>
                {ins.optimizationConfidence} conf
              </span>
            )}
          </div>
          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>
            Route {match.routeId} · {match.stopCount} stops · {match.nearestStopMiles} mi away
            {match.clusterDensity > 0 && (
              <span style={{ color: '#16A34A', fontWeight: 600, marginLeft: 4 }}>
                · {match.clusterDensity} nearby
              </span>
            )}
          </p>
        </div>
        {smoothCfg && (
          <span style={{ fontSize: 9, fontWeight: 700, color: smoothCfg.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {smoothCfg.icon} {match.routeSmoothness}
          </span>
        )}
      </div>

      {/* Suggested window */}
      {ins?.suggestedWindow && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: rank === 1 ? '#16A34A' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {rank === 1 ? 'Recommended: ' : 'Suggested: '}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>
            {ins.suggestedWindow}
          </span>
          <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 5 }}>
            (arrives {ins.estimatedArrivalTime})
          </span>
        </div>
      )}

      <ScoreBar score={match.scores.total} />

      {/* Insertion path */}
      {ins && (ins.prevStop || ins.nextStop) && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {ins.prevStop && (
            <span title={ins.insertAfterLabel || ins.prevStop.scheduledArrival}>{ins.prevStop.customerName}</span>
          )}
          {ins.prevStop && <span style={{ color: '#CBD5E1' }}>→</span>}
          <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NEW</span>
          {ins.nextStop && <span style={{ color: '#CBD5E1' }}>→</span>}
          {ins.nextStop && (
            <span title={ins.insertBeforeLabel || (ins.nextStop.isTimed ? `Timed: ${ins.nextStop.windowLabel}` : ins.nextStop.scheduledArrival)}>
              {ins.nextStop.customerName}
              {ins.nextStop.isTimed && <span style={{ color: '#F59E0B', marginLeft: 2 }}>⏱</span>}
            </span>
          )}
        </div>
      )}

      {/* Geo context: insertion position + closest stop + cluster */}
      {ins && (
        <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ins.insertionPositionLabel && (
            <span style={{ fontSize: 9, color: '#94A3B8' }}>
              <span style={{ fontWeight: 600, color: '#64748B' }}>Position</span> {ins.insertionPositionLabel}
            </span>
          )}
          {match.closestStop && (
            <span style={{ fontSize: 9, color: '#94A3B8' }}>
              <span style={{ fontWeight: 600, color: '#64748B' }}>Closest stop</span>{' '}
              {match.closestStop.customerName ?? match.closestStop.address} · {match.closestStop.distanceMiles} mi
              {match.closestStop.scheduledTime ? ` · ${match.closestStop.scheduledTime}` : ''}
              {' '}(stop {match.closestStop.stopIndex})
            </span>
          )}
          {clusterLabel && (
            <span style={{ fontSize: 9, fontWeight: 600, color: match.clusterDensity >= 3 ? '#16A34A' : match.clusterDensity >= 1 ? '#F59E0B' : '#94A3B8' }}>
              {match.clusterDensity >= 3 ? '✓ ' : match.clusterDensity >= 1 ? '~ ' : ''}{clusterLabel}
            </span>
          )}
        </div>
      )}

      {/* Stats row */}
      {ins && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>+Drive</span> {ins.addedDriveTime}
          </span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>+Miles</span> {ins.detourMiles} mi
          </span>
          {ins.serviceDuration && (
            <span style={{ fontSize: 10, color: '#475569' }}>
              <span style={{ fontWeight: 600 }}>Service</span> {ins.serviceDuration}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Cap</span> {match.capacity.remainingHours}h left
          </span>
          {!ins.viable && (
            <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>⚠ tight gap</span>
          )}
        </div>
      )}

      {/* Backtracking risk */}
      {ins?.backtrackingRisk && ins.backtrackingRisk !== 'None' && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: btCfg.color }}>
            {btCfg.icon} Backtracking:
          </span>{' '}
          <span style={{ fontSize: 10, color: btCfg.color }}>
            {ins.backtrackingRisk}
            {ins.backtrackingDetail ? ` — ${ins.backtrackingDetail}` : ''}
          </span>
        </div>
      )}
      {ins?.backtrackingRisk === 'None' && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#16A34A' }}>✓ Backtracking:</span>{' '}
          <span style={{ fontSize: 10, color: '#16A34A' }}>None</span>
        </div>
      )}

      {/* Timed appointment safety */}
      {ins?.timedSafetyLabel && (
        <div style={{ marginTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: timedSafetyColor }}>
            {ins.timedRisk === 'none' ? '✓' : ins.timedRisk === 'high' ? '✗' : '⚠'} Timed appts:
          </span>{' '}
          <span style={{ fontSize: 10, color: timedSafetyColor }}>{ins.timedSafetyLabel}</span>
        </div>
      )}

      {/* Estimated end of day — informational */}
      {ins?.eodLabel && (
        <div style={{ marginTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B' }}>◷ Est. end:</span>{' '}
          <span style={{ fontSize: 10, color: '#475569' }}>{ins.eodLabel}</span>
        </div>
      )}

      {/* Start/end location fit */}
      {ins?.startEndLocationFit && !ins.startEndLocationFit.startsWith('Neutral') && (
        <div style={{ marginTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#3B82F6' }}>◎ Location fit:</span>{' '}
          <span style={{ fontSize: 10, color: '#475569' }}>{ins.startEndLocationFit}</span>
        </div>
      )}

      {/* Reason */}
      {match.reason && (
        <p style={{ fontSize: 10, color: '#64748B', margin: '5px 0 0', lineHeight: 1.4 }}>
          {match.reason}
        </p>
      )}

      {/* Score breakdown */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, paddingTop: 5, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        {['geographic', 'travelEfficiency', 'timeWindow', 'capacity', 'insertionProximity'].map(k => {
          const labels = { geographic: 'Geo', travelEfficiency: 'Drive', timeWindow: 'Win', capacity: 'Cap', insertionProximity: 'Ins' };
          const v = match.scores[k] ?? 0;
          return (
            <div key={k} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: v >= 70 ? '#16A34A' : v >= 45 ? '#F59E0B' : '#CBD5E1' }}>{v}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{labels[k]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ResultCard;
