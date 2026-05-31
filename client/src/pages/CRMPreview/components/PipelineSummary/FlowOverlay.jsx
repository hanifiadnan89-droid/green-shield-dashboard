import { memo } from 'react';
import { STREAM_DEFS } from './streamPaths.js';
import ParticleCanvas from './ParticleCanvas.jsx';

// Back SVG: static glow washes + CSS dash-flow lines.
// Particles are drawn on a Canvas compositor layer (ParticleCanvas) — no SVG circles.
const FlowOverlay = memo(function FlowOverlay({ isScrollingRef }) {
  const svgStyle = {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none', overflow: 'visible',
  };

  return (
    <>
      <svg
        viewBox="0 0 1080 480"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="ps-streams-back"
        style={svgStyle}
      >
        {STREAM_DEFS.map(s => (
          <path key={`glow-${s.id}`} d={s.path}
            fill="none" stroke={s.glow}
            strokeWidth={s.glowW} strokeLinecap="round"
            opacity={0.08}
          />
        ))}

        {STREAM_DEFS.map(s => (
          <path key={`sharp-${s.id}`}
            d={s.path}
            fill="none" stroke={s.color}
            strokeWidth={s.mainW} strokeLinecap="round"
            opacity={0.82}
            className="ps-flow__sharp"
            style={{ '--flow-dur': `${s.dur}s` }}
          />
        ))}

        {STREAM_DEFS.map(s => (
          <path key={`hl-${s.id}`}
            d={s.path}
            fill="none" stroke={s.lighter}
            strokeWidth={s.hlW} strokeLinecap="round"
            opacity={0.60}
            className="ps-flow__highlight"
            style={{ '--flow-dur': `${(s.dur * 0.76).toFixed(2)}s` }}
          />
        ))}
      </svg>

      <ParticleCanvas isScrollingRef={isScrollingRef} />
    </>
  );
});

export default FlowOverlay;
