import { memo, useEffect, useRef } from 'react';
import { STREAM_DEFS, STREAM_RGB } from './streamPaths.js';
import { parseCubicBeziers, evalCubic } from './bezierUtils.js';

// Canvas 2D promoted to its own compositor layer (willChange:transform).
// The compositor re-uses the last GPU texture during scroll, so particles never
// freeze even if the main thread is briefly busy. No SVG style recalculation.
const ParticleCanvas = memo(function ParticleCanvas({ isScrollingRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    let displayW = 1080, displayH = 480;
    let scaleX = 1, scaleY = 1;
    let animFrame = null;
    let lastTime = null;

    const ctx = canvas.getContext('2d', { alpha: true });

    function resize() {
      const rect = canvas.getBoundingClientRect();
      displayW = rect.width || 1080;
      displayH = rect.height || 480;
      canvas.width = displayW * dpr;
      canvas.height = displayH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scaleX = displayW / 1080;
      scaleY = displayH / 480;
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const streamSegs = STREAM_DEFS.map(s => parseCubicBeziers(s.path));

    const particles = STREAM_DEFS.flatMap((s, si) =>
      Array.from({ length: s.particles }, (_, i) => ({
        si,
        t: i / Math.max(s.particles, 1),
        speed: 1 / s.dur,
        isLead: i === 0,
      }))
    );

    function evalPath(segs, t) {
      const n = segs.length;
      const idx = Math.min(Math.floor(t * n), n - 1);
      return evalCubic(t * n - idx, segs[idx]);
    }

    function draw(now) {
      if (document.hidden) {
        lastTime = null;
        animFrame = requestAnimationFrame(draw);
        return;
      }

      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, displayW, displayH);

      if (isScrollingRef?.current) {
        for (const p of particles) p.t = (p.t + dt * p.speed) % 1;
        animFrame = requestAnimationFrame(draw);
        return;
      }

      for (const p of particles) {
        p.t = (p.t + dt * p.speed) % 1;
        const rgb = STREAM_RGB[p.si];
        const pos = evalPath(streamSegs[p.si], p.t);
        const px = pos.x * scaleX;
        const py = pos.y * scaleY;
        const fade = p.t < 0.08 ? p.t / 0.08 : p.t > 0.92 ? (1 - p.t) / 0.08 : 1;
        const r = Math.max((p.isLead ? 3.2 : 2.2) * Math.min(scaleX, scaleY), 1.5);

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = p.isLead
          ? `rgba(255,255,255,${(fade * 0.92).toFixed(2)})`
          : `rgba(${rgb.r},${rgb.g},${rgb.b},${(fade * 0.82).toFixed(2)})`;
        ctx.fill();
      }

      animFrame = requestAnimationFrame(draw);
    }

    animFrame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animFrame);
      ro.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 6,
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    />
  );
});

export default ParticleCanvas;
