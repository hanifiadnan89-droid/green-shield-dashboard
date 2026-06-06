import { useCallback, useEffect, useRef, useState } from 'react';

export default function useCountingValue(initialValue = 0) {
  const [displayValue, setDisplayValue] = useState(initialValue);
  const displayRef = useRef(initialValue);
  const rafRef = useRef(0);

  useEffect(() => {
    displayRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const setImmediate = useCallback((value) => {
    cancelAnimationFrame(rafRef.current);
    const next = Math.max(0, Math.round(value));
    displayRef.current = next;
    setDisplayValue(next);
  }, []);

  const animateTo = useCallback((target, { duration = 680, onComplete } = {}) => {
    cancelAnimationFrame(rafRef.current);
    const start = displayRef.current;
    const end = Math.max(0, Math.round(target));
    const delta = end - start;

    if (delta === 0) {
      onComplete?.();
      return;
    }

    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(start + delta * eased);
      displayRef.current = next;
      setDisplayValue(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const getValue = useCallback(() => displayRef.current, []);

  return { displayValue, animateTo, setImmediate, getValue };
}
