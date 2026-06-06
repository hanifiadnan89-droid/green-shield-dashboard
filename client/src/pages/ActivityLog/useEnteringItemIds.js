import { useEffect, useRef, useState } from 'react';

export default function useEnteringItemIds(items) {
  const seenRef = useRef(new Set());
  const [enteringIds, setEnteringIds] = useState(() => new Set());

  useEffect(() => {
    const currentIds = items.map(item => item.id);
    const fresh = currentIds.filter(id => !seenRef.current.has(id));

    if (fresh.length && seenRef.current.size > 0) {
      setEnteringIds(new Set(fresh));
      const timer = window.setTimeout(() => setEnteringIds(new Set()), 380);
      seenRef.current = new Set(currentIds);
      return () => window.clearTimeout(timer);
    }

    seenRef.current = new Set(currentIds);
    return undefined;
  }, [items]);

  return enteringIds;
}
