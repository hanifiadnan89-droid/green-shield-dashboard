import { memo, useEffect, useRef, useState } from 'react';

// Plain RAF counter — only runs during the ~600 ms animation, then stops.
// No continuous subscription, no main-thread pressure at rest.
const AnimatedNumber = memo(function AnimatedNumber({ value = 0, className = '' }) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  const displayedRef = useRef(numeric);
  const [displayed, setDisplayed] = useState(numeric);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = displayedRef.current;
    const to = numeric;
    if (from === to) return;

    const duration = 600;
    let startTime = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      if (!startTime) startTime = now;
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(from + (to - from) * eased);
      displayedRef.current = cur;
      setDisplayed(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [numeric]);

  return <span className={className}>{displayed.toLocaleString()}</span>;
});

export default AnimatedNumber;
