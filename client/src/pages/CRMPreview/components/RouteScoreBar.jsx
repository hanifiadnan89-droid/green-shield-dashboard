// ---------------------------------------------------------------------------
// Score bar — extracted from RouteFinderWidget.jsx (Phase 11 step 1)
// ---------------------------------------------------------------------------
function ScoreBar({ score, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = score >= 70 ? '#16A34A' : score >= 45 ? '#F59E0B' : '#94A3B8';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded overflow-hidden bg-black/[0.06]">
        <div
          className="h-full rounded transition-[width] duration-[400ms] ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="type-label-md font-bold min-w-6 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

export default ScoreBar;
