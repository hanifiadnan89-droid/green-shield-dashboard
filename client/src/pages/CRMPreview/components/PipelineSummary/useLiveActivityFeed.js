import { useEffect, useState } from 'react';

/** Rotate first item to end — used by the live ticker interval */
export function rotateFeedOrder(prev) {
  if (prev.length <= 1) return prev;
  const next = [...prev];
  const first = next.shift();
  next.push(first);
  return next;
}

/** Cycles highlight + subtle reorder so the feed feels live */
export function useLiveActivityFeed(items, intervalMs = 3500, paused = false) {
  const [visible, setVisible] = useState(items);
  const [pulseId, setPulseId] = useState(null);

  useEffect(() => {
    setVisible(items);
  }, [items]);

  useEffect(() => {
    if (!items.length || paused) return undefined;

    const id = setInterval(() => {
      setPulseId(items[Math.floor(Math.random() * items.length)]?.id ?? null);
      setVisible((prev) => rotateFeedOrder(prev));
    }, intervalMs);

    return () => clearInterval(interval);
  }, [items, intervalMs, paused]);

  return { visible, pulseId, paused };
}
