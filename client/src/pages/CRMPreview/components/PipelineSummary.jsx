import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  MessageCircle,
  Send,
  Users,
  Star,
  Activity,
  Clock,
  Shield,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import './PipelineSummaryLivingFlow.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const TONE = {
  green: '#16A34A',
  blue: '#2563EB',
  orange: '#D97706',
  red: '#DC2626',
  purple: '#9333EA',
  ink: '#0F172A',
};

const RING_DEFS = [
  { key: 'reply',      label: 'Reply Rate',  color: '#16A34A', rateKey: 'reply',      Icon: MessageCircle },
  { key: 'active',     label: 'In Progress', color: '#2563EB', rateKey: 'active',     Icon: Clock },
  { key: 'agreements', label: 'Agreements',  color: '#D97706', rateKey: 'agreements', Icon: Shield },
];

const METRIC_DEFS = [
  { key: 'total',   label: 'Total',   valueKey: 'total',    Icon: Users,          color: '#16A34A' },
  { key: 'sent',    label: 'Sent',    valueKey: 'sentToday', Icon: Send,           color: '#2563EB' },
  { key: 'replies', label: 'Replies', valueKey: 'replied',  Icon: MessageCircle,  color: '#16A34A', rateKey: 'reply' },
  { key: 'errors',  label: 'Errors',  valueKey: 'errors',   Icon: AlertCircle,    color: '#DC2626' },
  { key: 'sold',    label: 'Sold',    valueKey: 'sold',     Icon: Star,           color: '#9333EA', rateKey: 'sold' },
];

// 12 streams: 6 incoming (left→orb) + 6 outgoing (orb→right)
// viewBox 0 0 1080 480 — orb center ≈ (520, 240), radius ≈ 95
const STREAM_DEFS = [
  // ── INCOMING ──────────────────────────────────────────────────────────────
  { id: 'in-g1',  color: '#22C55E', lighter: '#86EFAC', glow: '#22C55E', glowW: 26, mainW: 3.5, hlW: 1.6, particles: 3, dur: 3.8,
    path: 'M 0 128 C 120 122, 258 148, 355 175 C 400 190, 422 205, 430 218' },
  { id: 'in-g2',  color: '#16A34A', lighter: '#4ADE80', glow: '#16A34A', glowW: 16, mainW: 2.4, hlW: 1.1, particles: 2, dur: 4.5,
    path: 'M 0 158 C 120 153, 258 170, 355 194 C 400 207, 422 218, 430 230' },
  { id: 'in-b1',  color: '#60A5FA', lighter: '#BAE6FD', glow: '#3B82F6', glowW: 22, mainW: 3.0, hlW: 1.5, particles: 2, dur: 4.9,
    path: 'M 0 248 C 155 244, 298 244, 415 245 C 422 245, 427 246, 432 247' },
  { id: 'in-b2',  color: '#3B82F6', lighter: '#93C5FD', glow: '#2563EB', glowW: 13, mainW: 1.9, hlW: 0.9, particles: 1, dur: 5.7,
    path: 'M 0 262 C 155 258, 298 258, 415 259 C 422 259, 427 260, 432 261' },
  { id: 'in-o1',  color: '#FBBF24', lighter: '#FDE68A', glow: '#F59E0B', glowW: 22, mainW: 3.2, hlW: 1.4, particles: 2, dur: 5.3,
    path: 'M 0 325 C 112 320, 248 302, 345 284 C 388 275, 414 268, 430 264' },
  { id: 'in-o2',  color: '#D97706', lighter: '#FCD34D', glow: '#D97706', glowW: 13, mainW: 2.0, hlW: 0.9, particles: 1, dur: 6.3,
    path: 'M 0 344 C 112 339, 248 318, 345 300 C 388 290, 414 282, 430 278' },
  // ── OUTGOING — each path ends at its exact card-center y (x≈800 = card icon area) ──
  // Card center y estimates in SVG units (viewBox 480, ps-main ~500px):
  // Total=88  Sent=170  Replies=252  Errors=334  Sold=416
  { id: 'out-t1', color: '#22C55E', lighter: '#86EFAC', glow: '#22C55E', glowW: 24, mainW: 3.5, hlW: 1.6, particles: 3, dur: 3.8,
    path: 'M 612 220 C 658 148, 722 94, 800 53' },
  { id: 'out-t2', color: '#16A34A', lighter: '#4ADE80', glow: '#16A34A', glowW: 15, mainW: 2.4, hlW: 1.1, particles: 2, dur: 4.5,
    path: 'M 614 234 C 658 162, 722 110, 800 67' },
  { id: 'out-b',  color: '#60A5FA', lighter: '#BAE6FD', glow: '#3B82F6', glowW: 20, mainW: 3.0, hlW: 1.4, particles: 2, dur: 4.7,
    path: 'M 610 244 C 652 190, 716 158, 800 135' },
  { id: 'out-r',  color: '#34D399', lighter: '#6EE7B7', glow: '#10B981', glowW: 16, mainW: 2.5, hlW: 1.2, particles: 2, dur: 5.1,
    path: 'M 612 260 C 652 226, 716 218, 800 215' },
  { id: 'out-e',  color: '#F87171', lighter: '#FECACA', glow: '#EF4444', glowW: 16, mainW: 2.8, hlW: 1.2, particles: 2, dur: 5.5,
    path: 'M 608 272 C 648 264, 712 283, 800 292' },
  { id: 'out-p',  color: '#C084FC', lighter: '#E9D5FF', glow: '#9333EA', glowW: 18, mainW: 2.8, hlW: 1.3, particles: 3, dur: 6.1,
    path: 'M 604 282 C 638 298, 694 344, 800 370' },
];

const SPARKLINES = {
  total:   'M2 22 C14 18 22 10 34 11 C46 12 52 20 62 21 C72 22 80 8 94 5',
  sent:    'M2 22 C14 18 20 16 30 19 C42 23 46 11 58 14 C70 17 76 7 94 12',
  replies: 'M2 22 C14 9 24 13 34 22 C44 32 52 12 62 18 C72 25 80 16 94 6',
  errors:  'M2 20 C14 10 24 28 36 20 C48 11 54 30 66 20 C76 10 84 6 94 6',
  sold:    'M2 19 C14 21 22 22 32 17 C44 12 50 26 62 18 C74 11 80 24 94 6',
};

const TIMELINE_STEPS = [
  { time: '0:00', title: 'Idle State',     desc: 'Soft breathing orb and gentle stream flow' },
  { time: '1:00', title: 'Incoming Flow',  desc: 'Data flows from Performance Engine into the core' },
  { time: '2:00', title: 'Core Reaction',  desc: 'Orb pulses gently as new Replies come in' },
  { time: '3:00', title: 'Outgoing Flow',  desc: 'Processed data flows out to Key Metrics' },
  { time: '4:00', title: 'Metrics Update', desc: 'Metrics animate smoothly with subtle glow' },
];

// Orbital particles: 5 colored dots on 3 concentric paths.
// rev=true → counter-clockwise (adds variety without extra markup).
const ORBITAL_PARTICLES = [
  { color: '#22C55E', size: 12, radius: 134, dur: 32, delay:   0           }, // green,  outer  CW
  { color: '#3B82F6', size: 10, radius: 128, dur: 32, delay: -13, rev: true }, // blue,   outer  CCW
  { color: '#F97316', size: 11, radius: 110, dur: 24, delay:  -4           }, // orange, middle CW
  { color: '#A855F7', size: 10, radius: 105, dur: 24, delay: -15, rev: true }, // purple, middle CCW
  { color: '#EF4444', size: 11, radius:  88, dur: 18, delay:  -7           }, // red,    inner  CW
];

// ─── Bezier path utilities (shared by Canvas particle system) ─────────────────

function parseCubicBeziers(d) {
  const segs = [];
  let cx = 0, cy = 0;
  const tokens = d.replace(/,/g, ' ').trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i++];
    if (tok === 'M') {
      cx = parseFloat(tokens[i++]);
      cy = parseFloat(tokens[i++]);
    } else if (tok === 'C') {
      while (i < tokens.length && tokens[i] !== 'C' && tokens[i] !== 'M') {
        const cx1 = parseFloat(tokens[i++]), cy1 = parseFloat(tokens[i++]);
        const cx2 = parseFloat(tokens[i++]), cy2 = parseFloat(tokens[i++]);
        const x1  = parseFloat(tokens[i++]), y1  = parseFloat(tokens[i++]);
        segs.push({ x0: cx, y0: cy, cx1, cy1, cx2, cy2, x1, y1 });
        cx = x1; cy = y1;
      }
    }
  }
  return segs;
}

function evalCubic(t, { x0, y0, cx1, cy1, cx2, cy2, x1, y1 }) {
  const u = 1 - t;
  return {
    x: u*u*u*x0 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x1,
    y: u*u*u*y0 + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*y1,
  };
}

// ─── Canvas particle system helpers ───────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const STREAM_RGB = STREAM_DEFS.map(s => hexToRgb(s.lighter));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPercent = v => `${Math.round(Math.min(Math.max(+(v ?? 0), 0), 100))}%`;

// ─── AnimatedNumber ────────────────────────────────────────────────────────────
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

// ─── RingCard ──────────────────────────────────────────────────────────────────

const RingCard = memo(function RingCard({ def, pct }) {
  const r = 38;
  const sw = 5;
  const circ = 2 * Math.PI * r;
  const arc = (Math.min(Math.max(pct, 0), 100) / 100) * circ;
  const dashArray = `${arc} ${circ - arc}`;
  const dashOffset = circ * 0.25;
  const { Icon } = def;

  return (
    <div className="ps-ring-card">
      <div className="ps-ring-card__dial">
        <svg
          className="ps-ring-card__svg"
          viewBox="0 0 96 96"
          width={96}
          height={96}
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={48}
            cy={48}
            r={r}
            fill="none"
            stroke="rgba(203,213,225,0.40)"
            strokeWidth={sw}
          />
          {/* Arc */}
          <circle
            cx={48}
            cy={48}
            r={r}
            fill="none"
            stroke={def.color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            className="ps-ring-card__arc"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '48px 48px' }}
          />
        </svg>
        <div className="ps-ring-card__icon" style={{ color: def.color }}>
          <Icon size={18} />
        </div>
      </div>
      <div className="ps-ring-card__info">
        <span className="ps-ring-card__label">{def.label}</span>
        <span className="ps-ring-card__pct" style={{ color: def.color }}>
          {formatPercent(pct)}
        </span>
      </div>
    </div>
  );
});

// ─── ParticleCanvas ────────────────────────────────────────────────────────────
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
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, displayW, displayH);

      // During scroll: advance time but skip drawing — canvas stays blank.
      // The GPU texture holds the last frame; compositor shows it without freeze.
      if (isScrollingRef?.current) {
        for (const p of particles) p.t = (p.t + dt * p.speed) % 1;
        animFrame = requestAnimationFrame(draw);
        return;
      }

      for (const p of particles) {
        p.t = (p.t + dt * p.speed) % 1;
        const s = STREAM_DEFS[p.si];
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
  }, []); // eslint-disable-line

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

// ─── FlowOverlay ───────────────────────────────────────────────────────────────
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
      {/* Single SVG: glow washes + animated dash-flow lines + thin highlights */}
      <svg
        viewBox="0 0 1080 480"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="ps-streams-back"
        style={svgStyle}
      >
        {/* Glow wash — wide stroke, low opacity, no filter */}
        {STREAM_DEFS.map(s => (
          <path key={`glow-${s.id}`} d={s.path}
            fill="none" stroke={s.glow}
            strokeWidth={s.glowW} strokeLinecap="round"
            opacity={0.08}
          />
        ))}

        {/* Main lines — stroke-dashoffset animation */}
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

        {/* Thin highlights */}
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

      {/* Canvas layer — particles on GPU texture, blanks during scroll */}
      <ParticleCanvas isScrollingRef={isScrollingRef} />
    </>
  );
});

// ─── ReactiveOrb ───────────────────────────────────────────────────────────────
// Layer order (back→front):
//   tracks (static rings) → orbital particles → glass body (breathing) → text (fixed)
// Text lives OUTSIDE .ps-orb__body so it is never affected by the breathing scale.
// All animations: transform + opacity only. No filter, no box-shadow animation.

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
  }, [stats.total, stats.replied, stats.errors, stats.sold]); // eslint-disable-line

  return (
    <div className="ps-orb">

      {/* ── Concentric orbital track rings (static, no animation) ── */}
      <div className="ps-orb__track ps-orb__track--1" />
      <div className="ps-orb__track ps-orb__track--2" />
      <div className="ps-orb__track ps-orb__track--3" />
      <div className="ps-orb__track ps-orb__track--4" />

      {/* ── Orbital particles — CSS transform rotation, compositor-threaded ── */}
      {ORBITAL_PARTICLES.map((p, i) => (
        <div
          key={i}
          className={`ps-orbit-wrapper${p.rev ? ' ps-orbit-wrapper--rev' : ''}`}
          style={{ '--orb-dur': `${p.dur}s`, '--orb-delay': `${p.delay}s` }}
        >
          <div
            className="ps-orbit-dot"
            style={{ '--dot-color': p.color, '--dot-r': `${p.radius}px`, '--dot-size': `${p.size}px` }}
          />
        </div>
      ))}

      {/* ── Glass body (breathing) — text is OUTSIDE so it never moves ── */}
      <div className="ps-orb__body">
        {/* Reaction pulses — remount key triggers CSS animation */}
        <span key={`rp-${pulseReply}`} className={`ps-orb__pulse ps-orb__pulse--reply${pulseReply ? ' ps-orb__pulse--active' : ''}`} />
        <span key={`ep-${pulseError}`} className={`ps-orb__pulse ps-orb__pulse--error${pulseError ? ' ps-orb__pulse--active' : ''}`} />
        <span key={`sp-${pulseSold}`}  className={`ps-orb__pulse ps-orb__pulse--sold${pulseSold   ? ' ps-orb__pulse--active' : ''}`} />

        {/* Soft outer atmosphere (no filter) */}
        <div className="ps-orb__atmosphere" />

        {/* Multi-color energy ring — conic-gradient rotating via transform */}
        <div className="ps-orb__energy-ring" />

        {/* White glass sphere with internal refraction */}
        <div className="ps-orb__shell">
          <div className="ps-orb__refraction" />
          <div className="ps-orb__specular" />
        </div>
      </div>

      {/* ── Text anchor — absolutely centered, zero animation, never moves ── */}
      <div className="ps-orb__text">
        <AnimatedNumber value={stats.total} className="ps-orb__value" />
        <span className="ps-orb__label">TOTAL LEADS</span>
      </div>

    </div>
  );
});

// ─── PerformanceEngine ─────────────────────────────────────────────────────────

const PerformanceEngine = memo(function PerformanceEngine({ rates }) {
  return (
    <section className="ps-panel ps-panel--left">
      <div className="ps-panel__head">
        <Activity size={14} />
        <span>Performance Engine</span>
      </div>
      <div className="ps-rings-stack">
        {RING_DEFS.map(def => (
          <RingCard key={def.key} def={def} pct={rates[def.rateKey] ?? 0} />
        ))}
      </div>
      <div className="ps-rings-legend">
        {RING_DEFS.map(def => (
          <span
            key={def.key}
            className="ps-rings-legend__item"
            style={{ '--lc': def.color }}
          >
            <i />{def.label}
          </span>
        ))}
      </div>
    </section>
  );
});

// ─── LivingDataFlow ────────────────────────────────────────────────────────────

const LivingDataFlow = memo(function LivingDataFlow({ stats }) {
  return (
    <section className="ps-panel ps-panel--center">
      <div className="ps-panel__head">
        <Activity size={14} />
        <span>Living Data Flow</span>
      </div>
      <div className="ps-center-stage">
        <ReactiveOrb stats={stats} />
      </div>
    </section>
  );
});

// ─── MetricCard ────────────────────────────────────────────────────────────────

const MetricCard = memo(function MetricCard({ metric, value, rate }) {
  const navigate = useNavigate();
  const { Icon } = metric;

  return (
    <button
      type="button"
      className={`ps-metric-card ps-metric-card--${metric.key}`}
      style={{ '--mc': metric.color }}
      onClick={() => navigate('/leads')}
    >
      <span className="ps-metric-card__icon">
        <Icon size={20} />
      </span>
      <span className="ps-metric-card__body">
        <span className="ps-metric-card__label">{metric.label}</span>
        <span className="ps-metric-card__row">
          <AnimatedNumber value={value} className="ps-metric-card__value" />
          {rate != null && (
            <span className="ps-metric-card__rate">{formatPercent(rate)}</span>
          )}
        </span>
      </span>
      <svg className="ps-metric-card__spark" viewBox="0 0 96 36" aria-hidden="true">
        <path d={SPARKLINES[metric.key]} className="ps-metric-card__spark-path" />
      </svg>
    </button>
  );
});

// ─── KeyMetrics ────────────────────────────────────────────────────────────────

const KeyMetrics = memo(function KeyMetrics({ metrics, rates }) {
  return (
    <section className="ps-panel ps-panel--right">
      <div className="ps-panel__head">
        <BarChart3 size={14} />
        <span>Key Metrics</span>
      </div>
      <div className="ps-metrics-stack">
        {METRIC_DEFS.map(metric => {
          const value = metrics[metric.valueKey] ?? 0;
          const rate = metric.rateKey != null ? (rates[metric.rateKey] ?? null) : null;
          return (
            <MetricCard key={metric.key} metric={metric} value={value} rate={rate} />
          );
        })}
      </div>
    </section>
  );
});

// ─── TimelineStrip ─────────────────────────────────────────────────────────────

const TimelineStrip = memo(function TimelineStrip() {
  return (
    <div className="ps-timeline">
      <div className="ps-timeline__inner">
        {TIMELINE_STEPS.map((step, idx) => (
          <div key={step.time} className="ps-timeline__item">
            <span className="ps-timeline__time">{step.time}</span>
            <div className="ps-timeline__thumb">
              {/* Simplified orb ring thumbnail */}
              <svg viewBox="0 0 100 70" width={100} height={70} aria-hidden="true">
                <circle cx={50} cy={35} r={22} fill="none" stroke="rgba(22,163,74,0.22)" strokeWidth={3} />
                <circle cx={50} cy={35} r={14} fill="rgba(37,99,235,0.10)" stroke="rgba(37,99,235,0.30)" strokeWidth={2} />
                <circle cx={50} cy={35} r={6} fill="rgba(147,51,234,0.18)" />
                {idx > 0 && (
                  <line x1={8} y1={35} x2={28} y2={35} stroke="rgba(22,163,74,0.45)" strokeWidth={1.4} strokeDasharray="3 3" />
                )}
                {idx > 2 && (
                  <line x1={72} y1={35} x2={92} y2={35} stroke="rgba(37,99,235,0.45)" strokeWidth={1.4} strokeDasharray="3 3" />
                )}
              </svg>
            </div>
            <span className="ps-timeline__title">{step.title}</span>
            <span className="ps-timeline__desc">{step.desc}</span>
            {idx < TIMELINE_STEPS.length - 1 && (
              <span className="ps-timeline__arrow" aria-hidden="true">&#9658;</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── PipelineSummaryFlow ───────────────────────────────────────────────────────

function PipelineSummaryFlow({ stats }) {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const isScrollingRef = useRef(false);

  // Passive scroll listener — toggles ps-scrolling class via direct DOM (no React re-render).
  // CSS handles all visual degradation during scroll; ref tells canvas to skip drawing.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let timer = null;
    const onScroll = () => {
      isScrollingRef.current = true;
      el.classList.add('ps-scrolling');
      clearTimeout(timer);
      timer = setTimeout(() => {
        isScrollingRef.current = false;
        el.classList.remove('ps-scrolling');
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, []);

  const {
    total = 0,
    replied = 0,
    inProgress = 0,
    sentToday = 0,
    errors = 0,
    sold = 0,
    byTemplate = {},
  } = stats;

  const rates = useMemo(() => ({
    reply:      total > 0 ? (replied / total) * 100 : 0,
    active:     total > 0 ? (inProgress / total) * 100 : 0,
    agreements: total > 0 ? ((byTemplate.ag ?? 0) / total) * 100 : 0,
    sold:       total > 0 ? (sold / total) * 100 : 0,
  }), [total, replied, inProgress, byTemplate, sold]);

  const metrics = useMemo(() => ({
    total,
    sentToday,
    replied,
    errors,
    sold,
  }), [total, sentToday, replied, errors, sold]);


  if (total === 0) {
    return (
      <div className="p-card p-card-lift section-enter h-full flex flex-col items-center justify-center text-center p-8">
        <div className="ps-empty__icon">
          <TrendingUp size={20} />
        </div>
        <p className="text-sm font-medium text-[#64748B]">No lead data yet</p>
        <p className="text-xs text-[#94A3B8] mt-1">
          <Link to="/send" className="text-[#16A34A] hover:underline">
            Send your first template
          </Link>{' '}
          to see analytics
        </p>
      </div>
    );
  }

  return (
    <section ref={sectionRef} className="ps-root section-enter">
      <div className="ps-root__glow" />
      <header className="ps-root__header">
        <div>
          <h3>Pipeline Summary</h3>
          <p>
            Lead analytics ·{' '}
            <strong style={{ color: '#16A34A' }}>{total.toLocaleString()}</strong>{' '}
            total leads
          </p>
        </div>
        <button
          type="button"
          className="ps-root__view-btn"
          onClick={() => navigate('/leads')}
        >
          View Pipeline <ArrowUpRight size={13} />
        </button>
      </header>

      <div className="ps-main">
        <FlowOverlay isScrollingRef={isScrollingRef} />
        <PerformanceEngine rates={rates} />
        <LivingDataFlow stats={{ total, replied, errors, sold }} />
        <KeyMetrics metrics={metrics} rates={rates} />
      </div>

    </section>
  );
}

// ─── CSS (scoped inline styles for ps- classes) ────────────────────────────────
// These styles supplement PipelineSummaryLivingFlow.css with the new ps- class system.
// Injected once via a style tag to keep the JSX self-contained.

const PS_STYLES = `
/* ── ps-root ── */
.ps-root {
  --ps-ink: #0F172A;
  --ps-muted: #64748B;
  position: relative;
  overflow: hidden;
  width: 100%;
  padding: 32px 34px 36px;
  color: var(--ps-ink);
  background:
    radial-gradient(circle at 9% -8%, rgba(22,163,74,0.12), transparent 34%),
    radial-gradient(circle at 46% -6%, rgba(37,99,235,0.10), transparent 36%),
    radial-gradient(circle at 90% 0%, rgba(147,51,234,0.10), transparent 32%),
    linear-gradient(135deg, rgba(255,255,255,1.00), rgba(249,252,255,0.97) 48%, rgba(246,252,248,0.95));
  border: 1px solid rgba(226,232,240,0.84);
  border-radius: 22px;
  box-shadow: 0 20px 50px rgba(15,42,20,0.10), 0 1px 0 rgba(255,255,255,0.70) inset;
  transform: translateZ(0);
  contain: layout paint style;
  isolation: isolate;
}
.ps-root__glow {
  position: absolute;
  inset: -24% -8% auto;
  z-index: 0;
  height: 260px;
  pointer-events: none;
  background:
    radial-gradient(closest-side at 20% 50%, rgba(22,163,74,0.14), transparent),
    radial-gradient(closest-side at 48% 42%, rgba(37,99,235,0.11), transparent),
    radial-gradient(closest-side at 72% 54%, rgba(217,119,6,0.09), transparent),
    radial-gradient(closest-side at 90% 48%, rgba(147,51,234,0.09), transparent);
  opacity: 0.55;
}
.ps-root > *:not(.ps-root__glow) { position: relative; z-index: 1; }

/* ── ps-root__header ── */
.ps-root__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 28px;
}
.ps-root__header h3 {
  margin: 0;
  font-family: Poppins, Inter, sans-serif;
  font-size: 24px;
  font-weight: 800;
  color: #0F172A;
  line-height: 1.18;
}
.ps-root__header p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 14px;
  font-weight: 550;
}
.ps-root__view-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 9px 18px;
  border: 1px solid rgba(203,213,225,0.82);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.78));
  color: #0F172A;
  font-size: 13px;
  font-weight: 750;
  box-shadow: 0 10px 24px rgba(15,23,42,0.10), 0 1px 0 rgba(255,255,255,0.90) inset;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}
.ps-root__view-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(15,23,42,0.13), 0 1px 0 rgba(255,255,255,0.96) inset;
}

/* ── ps-main grid ── */
.ps-main {
  position: relative;
  display: grid;
  grid-template-columns: minmax(230px, 0.88fr) minmax(320px, 1.44fr) minmax(230px, 1fr);
  gap: 18px;
  min-height: 500px;
}

/* ── flow stream SVG layers ── */
.ps-streams-back {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
/* stroke-dashoffset is NOT compositor-threaded — no will-change hint */
.ps-flow__sharp {
  stroke-dasharray: 64 230;
  animation: ps-dash-flow var(--flow-dur, 4s) linear infinite;
  animation-play-state: running !important;
}
.ps-flow__highlight {
  stroke-dasharray: 28 160;
  animation: ps-dash-hl var(--flow-dur, 3s) linear infinite;
  animation-play-state: running !important;
}
@keyframes ps-dash-flow {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -320; }
}
@keyframes ps-dash-hl {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -180; }
}

/* ── ps-panel ── */
.ps-panel {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 19px;
  background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.82));
  border: 1px solid rgba(226,232,240,0.66);
  box-shadow: 0 10px 24px rgba(15,42,20,0.05), 0 1px 0 rgba(255,255,255,0.88) inset;
  padding: 22px 24px 26px;
}
.ps-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border-radius: inherit;
  background:
    radial-gradient(circle at 48% 38%, rgba(255,255,255,0.52), transparent 48%),
    linear-gradient(145deg, rgba(255,255,255,0.32), rgba(255,255,255,0.06));
}
.ps-panel__head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 20px;
  color: #334E71;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.ps-panel--center { padding: 22px 20px 20px; overflow: visible; }

/* ── ps-rings-stack ── */
.ps-rings-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

/* ── ps-ring-card ── */
.ps-ring-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border-radius: 13px;
  background: linear-gradient(180deg, rgba(255,255,255,0.68), rgba(255,255,255,0.38));
  border: 1px solid rgba(226,232,240,0.54);
  box-shadow: 0 6px 16px rgba(15,42,20,0.045), 0 1px 0 rgba(255,255,255,0.88) inset;
}
.ps-ring-card__dial {
  position: relative;
  flex-shrink: 0;
  width: 96px;
  height: 96px;
}
.ps-ring-card__svg {
  display: block;
  width: 96px;
  height: 96px;
}
.ps-ring-card__arc {
  transition: stroke-dasharray 0.6s ease;
}
.ps-ring-card__icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.ps-ring-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.ps-ring-card__label {
  font-size: 12px;
  font-weight: 750;
  color: #334E71;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.ps-ring-card__pct {
  font-family: Poppins, Inter, sans-serif;
  font-size: 26px;
  font-weight: 850;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* ── ps-rings-legend ── */
.ps-rings-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(203,213,225,0.44);
}
.ps-rings-legend__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 650;
  color: #1E3558;
}
.ps-rings-legend__item i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--lc, #16A34A);
  box-shadow: 0 0 10px color-mix(in srgb, var(--lc, #16A34A) 55%, transparent);
  flex-shrink: 0;
  font-style: normal;
}

/* ── ps-center-stage ── */
.ps-center-stage {
  position: relative;
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 400px;
  border-radius: 16px;
  overflow: visible;
  background: radial-gradient(circle at 50% 48%, rgba(248,250,252,0.55), transparent 70%);
}

/* ── ps-flow overlay sharp paths (override stroke-dasharray) ── */
.ps-flow__sharp {
  stroke-dasharray: 54 200;
  opacity: 0.68;
}

/* ── ps-orb — fills center stage, all children position relative to its center ── */
.ps-orb {
  position: relative;
  z-index: 5;
  width: 100%;
  align-self: stretch;
  min-height: 360px;
  transform: translateZ(0);
}

/* ── Concentric orbital track rings (static borders, no animation) ── */
.ps-orb__track {
  position: absolute;
  top: 50%; left: 50%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.ps-orb__track--1 { width: 208px; height: 208px; border: 1px solid rgba(148,163,184,0.20); }
.ps-orb__track--2 { width: 256px; height: 256px; border: 1px dashed rgba(148,163,184,0.13); }
.ps-orb__track--3 { width: 296px; height: 296px; border: 1px solid rgba(148,163,184,0.08); }
.ps-orb__track--4 { width: 336px; height: 336px; border: 1px dashed rgba(148,163,184,0.055); }

/* ── Orbital particle wrappers — only transform:rotate animates (compositor-threaded) ── */
.ps-orbit-wrapper {
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  transform-origin: 0 0;
  will-change: transform;
  animation: ps-orbit-cw linear infinite;
  animation-duration: var(--orb-dur, 32s);
  animation-delay: var(--orb-delay, 0s);
}
.ps-orbit-wrapper--rev { animation-name: ps-orbit-ccw; }
@keyframes ps-orbit-cw  { to { transform: rotate(360deg);  } }
@keyframes ps-orbit-ccw { to { transform: rotate(-360deg); } }

/* ── Orbital dot ── */
.ps-orbit-dot {
  position: absolute;
  width: var(--dot-size, 10px);
  height: var(--dot-size, 10px);
  top: calc(var(--dot-size, 10px) * -0.5);
  left: calc(var(--dot-r, 120px) - var(--dot-size, 10px) * 0.5);
  border-radius: 50%;
  background: var(--dot-color, #22C55E);
  box-shadow: 0 0 5px var(--dot-color), 0 0 12px color-mix(in srgb, var(--dot-color) 40%, transparent);
}
.ps-orbit-dot::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 300%;
  height: 300%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--dot-color) 0%, transparent 60%);
  opacity: 0.13;
  pointer-events: none;
}

/* ── Glass body — centered absolute, breathing scale, text is NOT inside ── */
.ps-orb__body {
  position: absolute;
  top: 50%; left: 50%;
  width: clamp(148px, 36%, 186px);
  height: clamp(148px, 36%, 186px);
  border-radius: 50%;
  will-change: transform;
  animation: ps-orb-breathe 10s ease-in-out infinite;
}
@keyframes ps-orb-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(1);     }
  50%       { transform: translate(-50%, -50%) scale(1.008); }
}

/* ── Reaction pulse rings ── */
.ps-orb__pulse {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
}
.ps-orb__pulse--reply  { border: 1.5px solid rgba(34,197,94,0.65);  }
.ps-orb__pulse--error  { border: 1.5px solid rgba(239,68,68,0.55);  }
.ps-orb__pulse--sold   { border: 1.5px solid rgba(168,85,247,0.62); }
.ps-orb__pulse--active { animation: ps-orb-pulse-out 0.92s ease-out forwards; }
@keyframes ps-orb-pulse-out {
  0%   { opacity: 0.55; transform: scale(1);    }
  100% { opacity: 0;    transform: scale(1.44); }
}

/* ── Soft outer atmosphere (no filter, no animation) ── */
.ps-orb__atmosphere {
  position: absolute;
  inset: -30%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(200,215,235,0.09) 0%, transparent 68%);
  pointer-events: none;
}

/* ── Multi-color energy ring — conic-gradient ring via CSS mask, rotates via transform ── */
.ps-orb__energy-ring {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    #22C55E 0%,
    #06B6D4 18%,
    #818CF8 36%,
    #EC4899 52%,
    #F97316 68%,
    #EAB308 84%,
    #22C55E 100%
  );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #fff 0);
          mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #fff 0);
  opacity: 0.86;
  will-change: transform;
  animation: ps-energy-ring-cw 40s linear infinite;
}
@keyframes ps-energy-ring-cw {
  to { transform: rotate(360deg); }
}

/* ── White glass sphere ── */
.ps-orb__shell {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  background:
    radial-gradient(circle at 34% 28%, rgba(255,255,255,1.0) 0%, rgba(255,255,255,0.95) 20%,
      rgba(224,242,254,0.90) 54%, rgba(209,250,229,0.84) 80%, rgba(240,253,250,0.78) 100%);
  box-shadow:
    inset 8px 10px 24px rgba(255,255,255,0.88),
    inset -5px -5px 16px rgba(148,163,184,0.12),
    0 0 0 1.5px rgba(255,255,255,0.96);
}

/* ── Moving refraction highlight (transform + opacity, compositor-threaded) ── */
.ps-orb__refraction {
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  background: radial-gradient(ellipse at 28% 36%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0) 52%);
  will-change: transform, opacity;
  animation: ps-refraction-drift 18s ease-in-out infinite;
}
@keyframes ps-refraction-drift {
  0%, 100% { transform: translateX(-10%) translateY(-4%); opacity: 0.90; }
  50%       { transform: translateX(10%)  translateY(4%);  opacity: 0.60; }
}

/* ── Static specular top-left shine ── */
.ps-orb__specular {
  position: absolute;
  top: 9%; left: 13%;
  width: 32%; height: 26%;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0) 100%);
  pointer-events: none;
}

/* ── Text anchor — absolutely centered, ZERO animation, never moves ── */
.ps-orb__text {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  pointer-events: none;
  user-select: none;
}
.ps-orb__value {
  display: block;
  font-family: Poppins, Inter, sans-serif;
  font-size: clamp(40px, 3.8vw, 56px);
  font-weight: 850;
  line-height: 0.95;
  color: #0F172A;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.ps-orb__label {
  display: block;
  margin-top: 10px;
  color: #334E71;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

/* ── ps-metrics-stack ── */
.ps-metrics-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

/* ── ps-metric-card ── */
.ps-metric-card {
  --mc: #16A34A;
  display: grid;
  grid-template-columns: 44px minmax(0,1fr) 80px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(226,232,240,0.66);
  border-radius: 14px;
  background:
    radial-gradient(circle at 88% 42%, color-mix(in srgb, var(--mc) 10%, transparent), transparent 52%),
    linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.54));
  box-shadow: 0 6px 16px rgba(15,42,20,0.055), 0 1px 0 rgba(255,255,255,0.90) inset;
  color: #0F172A;
  text-align: left;
  cursor: pointer;
  transform: translateZ(0);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}
/* Left-edge stream-arrival glow — color matches this card's incoming flow */
.ps-metric-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  width: 3px;
  height: 70%;
  border-radius: 0 2px 2px 0;
  background: var(--mc);
  opacity: 0.50;
  filter: blur(5px);
  box-shadow: 0 0 12px var(--mc);
  pointer-events: none;
}
.ps-metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(15,42,20,0.09), 0 1px 0 rgba(255,255,255,0.96) inset;
}
.ps-metric-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  color: var(--mc);
  background:
    radial-gradient(circle at 35% 22%, rgba(255,255,255,0.92), transparent 40%),
    color-mix(in srgb, var(--mc) 13%, rgba(255,255,255,0.76));
  border: 1px solid rgba(255,255,255,0.70);
  box-shadow: 0 6px 14px color-mix(in srgb, var(--mc) 14%, transparent), 0 1px 0 rgba(255,255,255,0.88) inset;
  flex-shrink: 0;
}
.ps-metric-card__body {
  min-width: 0;
}
.ps-metric-card__label {
  display: block;
  font-size: 11px;
  font-weight: 850;
  color: #1E3558;
  letter-spacing: 0.045em;
  text-transform: uppercase;
  margin-bottom: 3px;
}
.ps-metric-card__row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.ps-metric-card__value {
  font-family: Poppins, Inter, sans-serif;
  font-size: 22px;
  font-weight: 850;
  line-height: 1;
  color: #0F172A;
  font-variant-numeric: tabular-nums;
}
.ps-metric-card__rate {
  font-size: 11px;
  font-weight: 750;
  color: var(--mc);
  opacity: 0.82;
}
.ps-metric-card__spark {
  justify-self: end;
  width: 80px;
  height: 30px;
  overflow: visible;
}
.ps-metric-card__spark-path {
  fill: none;
  stroke: var(--mc);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.78;
}

/* ── ps-timeline ── */
.ps-timeline {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(203,213,225,0.44);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.ps-timeline__inner {
  display: flex;
  align-items: flex-start;
  gap: 0;
  min-width: 680px;
  position: relative;
}
.ps-timeline__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.ps-timeline__time {
  font-size: 11px;
  font-weight: 850;
  color: #64748B;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.ps-timeline__thumb {
  width: 100px;
  height: 70px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(226,232,240,0.60);
  background: linear-gradient(135deg, rgba(255,255,255,0.72), rgba(249,252,255,0.52));
  box-shadow: 0 6px 16px rgba(15,42,20,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ps-timeline__title {
  margin-top: 8px;
  font-size: 11px;
  font-weight: 750;
  color: #1E3558;
  text-align: center;
  white-space: nowrap;
}
.ps-timeline__desc {
  font-size: 10px;
  color: #64748B;
  text-align: center;
  max-width: 110px;
  line-height: 1.4;
  margin-top: 3px;
}
.ps-timeline__arrow {
  position: absolute;
  top: calc(70px + 8px + 8px + 2px);
  right: -8px;
  font-size: 11px;
  color: rgba(100,116,139,0.50);
  transform: translateY(-50%);
  pointer-events: none;
}

/* ── ps-empty ── */
.ps-empty__icon {
  display: inline-flex;
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 14px;
  color: #94A3B8;
  background: #F8FAFC;
}

/* ── Scroll-performance degradation ──────────────────────────────────────────
   .ps-scrolling is set via direct DOM classList (no React re-render).
   During scroll: pause stroke-dashoffset + orb animations to free main thread.
   Glow fades to zero. Canvas blanks itself via isScrollingRef in JS.
   Everything restores smoothly via CSS transition after 150ms idle. */

.ps-root__glow {
  transition: opacity 0.35s ease;
}
.ps-root.ps-scrolling .ps-root__glow {
  opacity: 0 !important;
  transition: opacity 0.08s ease;
}

.ps-root.ps-scrolling .ps-flow__sharp,
.ps-root.ps-scrolling .ps-flow__highlight {
  animation-play-state: paused !important;
}

.ps-root.ps-scrolling .ps-orb__body,
.ps-root.ps-scrolling .ps-orb__energy-ring,
.ps-root.ps-scrolling .ps-orb__refraction,
.ps-root.ps-scrolling .ps-orbit-wrapper {
  animation-play-state: paused !important;
}

/* At rest: ensure animations are running */
.ps-orb__body,
.ps-orb__energy-ring,
.ps-orb__refraction,
.ps-orbit-wrapper,
.ps-flow__sharp,
.ps-flow__highlight {
  animation-play-state: running;
}


/* ── responsive ── */
@media (max-width: 1180px) {
  .ps-main { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .ps-root { padding: 18px; border-radius: 18px; }
  .ps-root__header { flex-direction: column; align-items: stretch; }
  .ps-root__view-btn { width: 100%; justify-content: center; }
  .ps-metric-card { grid-template-columns: 40px minmax(0,1fr); }
  .ps-metric-card__spark { display: none; }
}
`;

// Inject styles once
if (typeof document !== 'undefined' && !document.getElementById('ps-styles')) {
  const style = document.createElement('style');
  style.id = 'ps-styles';
  style.textContent = PS_STYLES;
  document.head.appendChild(style);
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function PipelineSummary({ stats = {} }) {
  return <PipelineSummaryFlow stats={stats} />;
}
