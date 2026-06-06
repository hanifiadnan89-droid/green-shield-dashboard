import { useCallback, useEffect, useRef, useState } from 'react';

const BASE_SPEED = 0.32;
const HOVER_FACTOR = 0.1;
const MIN_GAP = 18;
const REPEL_STRENGTH = 0.06;

export default function useFloatingMotion(items, { paused = false } = {}) {
  const containerRef = useRef(null);
  const [positions, setPositions] = useState({});
  const bodiesRef = useRef(new Map());
  const sizesRef = useRef(new Map());
  const hoveredRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const rafRef = useRef(0);

  const setHovered = useCallback((id) => {
    hoveredRef.current = id;
    setHoveredId(id);
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
        const size = sizesRef.current.get(item.id) || { w: 280, h: 72 };
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
      const entries = items
        .map(item => ({ item, body: bodiesRef.current.get(item.id) }))
        .filter(entry => entry.body);

      for (const { item, body } of entries) {
        const size = sizesRef.current.get(item.id) || { w: 280, h: 72 };
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

      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const a = entries[i];
          const b = entries[j];
          const sizeA = sizesRef.current.get(a.item.id) || { w: 280, h: 72 };
          const sizeB = sizesRef.current.get(b.item.id) || { w: 280, h: 72 };
          const bodyA = bodiesRef.current.get(a.item.id);
          const bodyB = bodiesRef.current.get(b.item.id);
          if (!bodyA || !bodyB) continue;

          const centerAX = bodyA.x + sizeA.w / 2;
          const centerAY = bodyA.y + sizeA.h / 2;
          const centerBX = bodyB.x + sizeB.w / 2;
          const centerBY = bodyB.y + sizeB.h / 2;
          const dx = centerBX - centerAX;
          const dy = centerBY - centerAY;
          const distance = Math.hypot(dx, dy) || 0.001;
          const minDistance = (sizeA.w + sizeB.w) / 2 + MIN_GAP;

          if (distance >= minDistance) continue;

          const push = ((minDistance - distance) / minDistance) * REPEL_STRENGTH;
          const nx = dx / distance;
          const ny = dy / distance;

          bodyA.x -= nx * push;
          bodyA.y -= ny * push;
          bodyB.x += nx * push;
          bodyB.y += ny * push;

          bodyA.vx -= nx * 0.02;
          bodyA.vy -= ny * 0.02;
          bodyB.vx += nx * 0.02;
          bodyB.vy += ny * 0.02;

          updates[a.item.id] = { x: bodyA.x, y: bodyA.y };
          updates[b.item.id] = { x: bodyB.x, y: bodyB.y };
        }
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
    hoveredId,
  };
}
