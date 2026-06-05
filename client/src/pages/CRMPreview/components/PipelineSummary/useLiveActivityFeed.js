import { useEffect, useState } from 'react';

/** Cycles highlight + subtle reorder so the feed feels live */
export function useLiveActivityFeed(items, intervalMs = 3500) {
  const [visible, setVisible] = useState(items);
  const [pulseId, setPulseId] = useState(null);

  useEffect(() => {
    setVisible(items);
  }, [items]);

  useEffect(() => {
    if (!items.length) return undefined;
    const id = setInterval(() => {
      setPulseId(items[Math.floor(Math.random() * items.length)]?.id ?? null);
      setVisible(prev => {
        if (prev.length <= 1) return prev;
        const next = [...prev];
        const first = next.shift();
        next.push(first);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [items, intervalMs]);

  return { visible, pulseId };
}
