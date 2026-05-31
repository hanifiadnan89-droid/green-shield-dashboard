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
  Shield,
  TrendingUp,
  BarChart3,
  PhoneOff,
} from 'lucide-react';
// ─── Constants ────────────────────────────────────────────────────────────────

const RING_DEFS = [
  { key: 'reply',      label: 'Reply Rate',  color: '#16A34A', rateKey: 'reply',      Icon: MessageCircle },
  { key: 'noAnswer',   label: 'No Answer',   color: '#2563EB', rateKey: 'noAnswer',  Icon: PhoneOff },
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

// Generates a 2× wide seamlessly-looping sine wave path.
// cycles must be an even integer so the wave at x=0 and x=totalW/2 are identical,
// enabling a perfect translateX(-totalW/2) CSS/SVG loop with zero discontinuity.
function genSparkPath(totalW, h, cycles, amp, phase) {
  const midY = h / 2;
  const steps = 96;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * totalW;
    const t = (i / steps) * cycles * 2 * Math.PI + phase;
    // slight second harmonic for organic feel; 2×cycles is also even → still seamless
    const y = midY - amp * Math.sin(t) - amp * 0.2 * Math.sin(2 * t + 0.5);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

// Each path spans 0→192 (2× the 96-wide viewBox). The SVG clips to 96 wide,
// and <animateTransform> scrolls from 0 to -96 SVG units, then loops instantly.
const SPARKLINES = {
  total:   genSparkPath(192, 36, 2, 6.5, 0),
  sent:    genSparkPath(192, 36, 2, 4.0, Math.PI * 0.7),
  replies: genSparkPath(192, 36, 2, 7.0, Math.PI * 1.3),
  errors:  genSparkPath(192, 36, 2, 8.0, Math.PI * 0.4),
  sold:    genSparkPath(192, 36, 2, 5.5, Math.PI * 0.9),
};

const SPARK_DURATIONS = { total: 5.5, sent: 7, replies: 4, errors: 5, sold: 6.5 };

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
  }, [stats.total, stats.replied, stats.errors, stats.sold]); // eslint-disable-line

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
        <path d={SPARKLINES[metric.key]} className="ps-metric-card__spark-path">
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to="-96 0"
            dur={`${SPARK_DURATIONS[metric.key]}s`}
            repeatCount="indefinite"
          />
        </path>
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
    sentToday = 0,
    errors = 0,
    sold = 0,
    byTemplate = {},
  } = stats;

  const rates = useMemo(() => ({
    reply:      total > 0 ? (replied / total) * 100 : 0,
    noAnswer:   total > 0 ? ((byTemplate.na ?? 0) / total) * 100 : 0,
    agreements: total > 0 ? ((byTemplate.ag ?? 0) / total) * 100 : 0,
    sold:       total > 0 ? (sold / total) * 100 : 0,
  }), [total, replied, byTemplate, sold]);

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

// ─── Export ────────────────────────────────────────────────────────────────────

export default function PipelineSummary({ stats = {} }) {
  return <PipelineSummaryFlow stats={stats} />;
}
