import { useCallback, useEffect, useRef, useState } from 'react';

const BASE_SPEED = 0.32;
const HOVER_FACTOR = 0.1;

export default function useFloatingMotion(items, { paused = false } = {}) {
  const containerRef = useRef(null);
  const [positions, setPositions] = useState({});
  const bodiesRef = useRef(new Map());
  const sizesRef = useRef(new Map());
  const hoveredRef = useRef(null);
  const rafRef = useRef(0);

  const setHovered = useCallback((id) => {
    hoveredRef.current = id;
  }, []);

  const registerSize = useCallback((id, width, height) => {
    if (!id || !width || !height) return;
    sizesRef.current.set(id, { w: width, h: height });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || paused) return undefined;

    const syncBodies = () => {
      const rect = container.getBoundingClientRect();
      const next = new Map(bodiesRef.current);
      const ids = new Set(items.map(item => item.id));

      for (const id of [...next.keys()]) {
        if (!ids.has(id)) next.delete(id);
      }

      for (const item of items) {
        if (next.has(item.id)) continue;
        const size = sizesRef.current.get(item.id) || { w: 280, h: 48 };
        next.set(item.id, {
          x: Math.random() * Math.max(12, rect.width - size.w - 12),
          y: Math.random() * Math.max(12, rect.height - size.h - 12),
          vx: (Math.random() > 0.5 ? 1 : -1) * (BASE_SPEED + Math.random() * 0.14),
          vy: (Math.random() > 0.5 ? 1 : -1) * (BASE_SPEED + Math.random() * 0.14),
        });
      }

      bodiesRef.current = next;
    };

    syncBodies();

    const tick = () => {
      const rect = container.getBoundingClientRect();
      const updates = {};

      for (const item of items) {
        const body = bodiesRef.current.get(item.id);
        if (!body) continue;

        const size = sizesRef.current.get(item.id) || { w: 280, h: 48 };
        const slow = hoveredRef.current === item.id;
        const speedMul = slow ? HOVER_FACTOR : 1;

        let { x, y, vx, vy } = body;
        x += vx * speedMul;
        y += vy * speedMul;

        const maxX = Math.max(0, rect.width - size.w);
        const maxY = Math.max(0, rect.height - size.h);

        if (x <= 0) {
          x = 0;
          vx = Math.abs(vx);
        }
        if (y <= 0) {
          y = 0;
          vy = Math.abs(vy);
        }
        if (x >= maxX) {
          x = maxX;
          vx = -Math.abs(vx);
        }
        if (y >= maxY) {
          y = maxY;
          vy = -Math.abs(vy);
        }

        bodiesRef.current.set(item.id, { x, y, vx, vy });
        updates[item.id] = { x, y };
      }

      setPositions(updates);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [items, paused]);

  return {
    containerRef,
    positions,
    setHovered,
    registerSize,
  };
}
