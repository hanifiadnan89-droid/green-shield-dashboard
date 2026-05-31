import { memo, useEffect, useRef, useState } from 'react';
import AnimatedNumber from './AnimatedNumber.jsx';

// Pulses use CSS @keyframes triggered by remounting the span (key change).
// No GSAP ticker — zero continuous RAF usage at rest.
const ReactiveOrb = memo(function ReactiveOrb({ stats }) {
  const [pulseReply, setPulseReply] = useState(0);
  const [pulseError, setPulseError] = useState(0);
  const [pulseSold,  setPulseSold]  = useState(0);
  const prevRef = useRef(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (!prev) { prevRef.current = stats; return; }

    if (stats.replied > (prev.replied ?? 0)) setPulseReply(n => n + 1);
    if (stats.errors  > (prev.errors  ?? 0)) setPulseError(n => n + 1);
    if (stats.sold    > (prev.sold    ?? 0)) setPulseSold(n  => n + 1);

    prevRef.current = stats;
  }, [stats.total, stats.replied, stats.errors, stats.sold]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ps-orb">
      <span key={`rp-${pulseReply}`} className={`ps-orb__pulse ps-orb__pulse--reply${pulseReply ? ' ps-orb__pulse--active' : ''}`} />
      <span key={`ep-${pulseError}`} className={`ps-orb__pulse ps-orb__pulse--error${pulseError ? ' ps-orb__pulse--active' : ''}`} />
      <span key={`sp-${pulseSold}`}  className={`ps-orb__pulse ps-orb__pulse--sold${pulseSold   ? ' ps-orb__pulse--active' : ''}`} />
      <span className="ps-orb__shell" />
      <span className="ps-orb__shimmer" />
      <span className="ps-orb__ring" />
      <span className="ps-orb__energy" />
      <span className="ps-orb__glass" />
      <AnimatedNumber value={stats.total} className="ps-orb__value" />
      <span className="ps-orb__label">TOTAL LEADS</span>
    </div>
  );
});

export default ReactiveOrb;
