// ---------------------------------------------------------------------------
// Score bar — extracted from RouteFinderWidget.jsx (Phase 11 step 1)
// ---------------------------------------------------------------------------
function ScoreBar({ score, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = score >= 70 ? '#16A34A' : score >= 45 ? '#F59E0B' : '#94A3B8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

export default ScoreBar;
