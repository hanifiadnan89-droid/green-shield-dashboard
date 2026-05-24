import { memo, useEffect, useMemo, useRef } from 'react';
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
import gsap from 'gsap';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPercent = v => `${Math.round(Math.min(Math.max(+(v ?? 0), 0), 100))}%`;

// ─── AnimatedNumber ────────────────────────────────────────────────────────────

const AnimatedNumber = memo(function AnimatedNumber({ value = 0, className = '' }) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  const mv = useMotionValue(numeric);
  const spring = useSpring(mv, { stiffness: 110, damping: 22, mass: 0.6 });
  const rounded = useTransform(spring, latest => Math.round(latest).toLocaleString());

  useEffect(() => {
    mv.set(numeric);
  }, [mv, numeric]);

  return <motion.span className={className}>{rounded}</motion.span>;
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

// ─── FlowOverlay ───────────────────────────────────────────────────────────────
// Two-SVG system: back layer (glow+lines) behind panels, front layer (particles) above orb.
// Particles use SMIL animateMotion — browser-native SVG engine, never pauses during scroll.

const FlowOverlay = memo(function FlowOverlay() {
  const svgStyle = {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none', overflow: 'visible',
  };

  return (
    <>
      {/* BACK SVG — glow washes + main lines + thin highlights */}
      <svg
        viewBox="0 0 1080 480"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="ps-streams-back"
        style={svgStyle}
      >
        {/* Layer 1 — Wide soft glow wash (no SVG filter — wide stroke + opacity only, GPU-safe) */}
        {STREAM_DEFS.map(s => (
          <path key={`glow-${s.id}`} d={s.path}
            fill="none" stroke={s.glow}
            strokeWidth={s.glowW} strokeLinecap="round"
            opacity={0.10}
          />
        ))}

        {/* Layer 2 — Main luminous lines (CSS-animated dashoffset, never pauses) */}
        {STREAM_DEFS.map(s => (
          <path key={`sharp-${s.id}`}
            id={`ps-sharp-${s.id}`}
            d={s.path}
            fill="none" stroke={s.color}
            strokeWidth={s.mainW} strokeLinecap="round"
            opacity={0.84}
            className="ps-flow__sharp"
            style={{ '--flow-dur': `${s.dur}s` }}
          />
        ))}

        {/* Layer 3 — Thin highlight lines (CSS-animated, faster) */}
        {STREAM_DEFS.map(s => (
          <path key={`hl-${s.id}`}
            id={`ps-hl-${s.id}`}
            d={s.path}
            fill="none" stroke={s.lighter}
            strokeWidth={s.hlW} strokeLinecap="round"
            opacity={0.70}
            className="ps-flow__highlight"
            style={{ '--flow-dur': `${(s.dur * 0.76).toFixed(2)}s` }}
          />
        ))}
      </svg>

      {/* FRONT SVG — SMIL animateMotion particles, browser-native SVG engine, never pauses */}
      <svg
        viewBox="0 0 1080 480"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="ps-streams-front"
        style={svgStyle}
      >
        {STREAM_DEFS.flatMap(s =>
          Array.from({ length: s.particles }, (_, i) => {
            const begin = `${(-(i / Math.max(s.particles, 1)) * s.dur).toFixed(2)}s`;
            return (
              <circle
                key={`p-${s.id}-${i}`}
                r={i === 0 ? 3.2 : 2.2}
                fill={i === 0 ? '#FFFFFF' : s.lighter}
              >
                <animateMotion
                  dur={`${s.dur}s`}
                  repeatCount="indefinite"
                  begin={begin}
                  path={s.path}
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.08;0.92;1"
                  dur={`${s.dur}s`}
                  repeatCount="indefinite"
                  begin={begin}
                />
              </circle>
            );
          })
        )}
      </svg>
    </>
  );
});

// ─── ReactiveOrb ───────────────────────────────────────────────────────────────

const ReactiveOrb = memo(function ReactiveOrb({ stats }) {
  const orbRef = useRef(null);
  const replyPulseRef = useRef(null);
  const errorPulseRef = useRef(null);
  const soldPulseRef = useRef(null);
  const prevRef = useRef(stats);

  useEffect(() => {
    const prev = prevRef.current;
    if (!prev) { prevRef.current = stats; return; }

    if (stats.total !== prev.total && orbRef.current) {
      gsap.fromTo(
        orbRef.current,
        { scale: 0.994 },
        { scale: 1, duration: 0.42, ease: 'power2.out', overwrite: 'auto' },
      );
    }

    if (stats.replied > (prev.replied ?? 0) && replyPulseRef.current) {
      gsap.fromTo(
        replyPulseRef.current,
        { opacity: 0.48, scale: 1 },
        { opacity: 0, scale: 1.32, duration: 0.92, ease: 'power2.out', overwrite: 'auto' },
      );
    }

    if (stats.errors > (prev.errors ?? 0) && errorPulseRef.current) {
      gsap.fromTo(
        errorPulseRef.current,
        { opacity: 0.40, scale: 1 },
        { opacity: 0, scale: 1.38, duration: 1.0, ease: 'power2.out', overwrite: 'auto' },
      );
    }

    if (stats.sold > (prev.sold ?? 0) && soldPulseRef.current) {
      gsap.fromTo(
        soldPulseRef.current,
        { opacity: 0.54, scale: 0.96 },
        { opacity: 0, scale: 1.26, duration: 0.70, ease: 'back.out(1.8)', overwrite: 'auto' },
      );
    }

    prevRef.current = stats;
  }, [stats.total, stats.replied, stats.errors, stats.sold]); // eslint-disable-line

  return (
    <div className="ps-orb" ref={orbRef}>
      <span ref={replyPulseRef} className="ps-orb__pulse ps-orb__pulse--reply" />
      <span ref={errorPulseRef} className="ps-orb__pulse ps-orb__pulse--error" />
      <span ref={soldPulseRef}  className="ps-orb__pulse ps-orb__pulse--sold" />
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
        <FlowOverlay />
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
  box-shadow:
    0 30px 78px rgba(15,42,20,0.13),
    0 2px 0 rgba(255,255,255,0.70) inset,
    0 -1px 0 rgba(15,42,20,0.035) inset;
  transform: translateZ(0);
}
.ps-root__glow {
  position: absolute;
  inset: -24% -8% auto;
  z-index: 0;
  height: 260px;
  pointer-events: none;
  background:
    radial-gradient(closest-side at 20% 50%, rgba(22,163,74,0.18), transparent),
    radial-gradient(closest-side at 48% 42%, rgba(37,99,235,0.15), transparent),
    radial-gradient(closest-side at 72% 54%, rgba(217,119,6,0.12), transparent),
    radial-gradient(closest-side at 90% 48%, rgba(147,51,234,0.12), transparent);
  filter: blur(18px);
  opacity: 0.48;
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
.ps-streams-front {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  will-change: transform;
  transform: translateZ(0);
}
/* CSS-driven dash animations — run on compositor thread, never pause during scroll */
.ps-flow__sharp {
  stroke-dasharray: 64 230;
  animation: ps-dash-flow var(--flow-dur, 4s) linear infinite;
  animation-play-state: running !important;
  will-change: stroke-dashoffset;
}
.ps-flow__highlight {
  stroke-dasharray: 28 160;
  animation: ps-dash-hl var(--flow-dur, 3s) linear infinite;
  animation-play-state: running !important;
  will-change: stroke-dashoffset;
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
  box-shadow:
    0 18px 36px rgba(15,42,20,0.055),
    0 1px 0 rgba(255,255,255,0.88) inset,
    0 -1px 0 rgba(15,42,20,0.03) inset;
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
.ps-panel--center { padding: 22px 20px 20px; }

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
  align-items: center;
  justify-content: center;
  min-height: 400px;
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 44%, rgba(255,255,255,0.46), rgba(255,255,255,0.14) 38%, transparent 58%),
    radial-gradient(circle at 44% 46%, rgba(22,163,74,0.10), transparent 35%),
    radial-gradient(circle at 62% 44%, rgba(37,99,235,0.10), transparent 36%),
    linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06));
}
.ps-center-stage::before {
  content: '';
  position: absolute;
  inset: 40px 60px 80px;
  pointer-events: none;
  border-radius: 999px;
  background:
    repeating-radial-gradient(circle, rgba(148,163,184,0.12) 0 1px, transparent 1px 28px),
    radial-gradient(circle, rgba(255,255,255,0.26), transparent 68%);
  opacity: 0.34;
  mask-image: radial-gradient(circle, #000 0%, transparent 70%);
}

/* ── ps-flow overlay sharp paths ── */
.ps-flow__sharp {
  stroke-dasharray: 54 200;
  opacity: 0.68;
  will-change: stroke-dashoffset;
  transform: translateZ(0);
}

/* ── ps-orb ── */
.ps-orb {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: clamp(200px, 40%, 248px);
  aspect-ratio: 1;
  border-radius: 999px;
  transform: translateZ(0);
}
.ps-orb__pulse {
  position: absolute;
  inset: -10px;
  border-radius: 999px;
  opacity: 0;
  pointer-events: none;
}
.ps-orb__pulse--reply {
  border: 1px solid rgba(22,163,74,0.55);
  box-shadow: 0 0 0 6px rgba(22,163,74,0.10);
}
.ps-orb__pulse--error {
  border: 1px solid rgba(220,38,38,0.46);
  box-shadow: 0 0 0 6px rgba(220,38,38,0.08);
}
.ps-orb__pulse--sold {
  border: 1px solid rgba(147,51,234,0.50);
  box-shadow: 0 0 0 5px rgba(147,51,234,0.10);
}
.ps-orb__shell {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 26% 18%, rgba(255,255,255,0.98), rgba(255,255,255,0.46) 16%, transparent 29%),
    radial-gradient(circle at 68% 30%, rgba(147,51,234,0.20), transparent 38%),
    radial-gradient(circle at 30% 78%, rgba(22,163,74,0.28), transparent 42%),
    radial-gradient(circle at 58% 64%, rgba(37,99,235,0.22), transparent 44%),
    linear-gradient(145deg, rgba(255,255,255,0.68), rgba(221,246,237,0.44));
  border: 1px solid rgba(255,255,255,0.84);
  box-shadow:
    0 18px 42px rgba(14,165,233,0.16),
    0 0 0 9px rgba(255,255,255,0.28),
    0 0 38px rgba(34,211,238,0.20),
    inset 16px 18px 36px rgba(255,255,255,0.58),
    inset -18px -18px 42px rgba(15,42,20,0.16);
  animation: ps-orb-breathe 10s ease-in-out infinite;
}
.ps-orb__shimmer {
  position: absolute;
  inset: 12px;
  border-radius: inherit;
  background:
    radial-gradient(ellipse at 28% 16%, rgba(255,255,255,0.88), transparent 25%),
    linear-gradient(126deg, rgba(255,255,255,0.34), transparent 34%, rgba(255,255,255,0.16) 60%, transparent),
    conic-gradient(from 38deg, rgba(22,163,74,0.12), rgba(37,99,235,0.14), rgba(147,51,234,0.12), rgba(217,119,6,0.10), rgba(22,163,74,0.12));
  opacity: 0.70;
  mix-blend-mode: screen;
  animation: ps-orb-glass-drift 16s ease-in-out infinite;
}
.ps-orb__ring {
  position: absolute;
  inset: 18px;
  border-radius: inherit;
  border: 1px solid rgba(125,211,252,0.40);
  box-shadow: 0 0 18px rgba(125,211,252,0.18), inset 0 0 20px rgba(22,163,74,0.10);
  animation: ps-orb-ring-pulse 10s ease-in-out infinite;
}
.ps-orb__energy {
  position: absolute;
  inset: 26px;
  border-radius: inherit;
  background:
    linear-gradient(90deg, transparent 8%, rgba(255,255,255,0.36) 48%, transparent 72%),
    radial-gradient(circle at 55% 42%, rgba(125,211,252,0.18), transparent 44%);
  opacity: 0.34;
  animation: ps-orb-energy-drift 14s ease-in-out infinite;
}
.ps-orb__glass {
  position: absolute;
  inset: 14px;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 48%, rgba(244,250,255,0.9) 0%, rgba(232,245,252,0.7) 58%, rgba(216,237,250,0.16) 86%, transparent 100%);
}
.ps-orb__value {
  position: relative;
  z-index: 6;
  font-family: Poppins, Inter, sans-serif;
  font-size: clamp(46px, 4.5vw, 60px);
  font-weight: 850;
  line-height: 0.9;
  color: #0F172A;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.ps-orb__label {
  position: relative;
  z-index: 6;
  margin-top: 12px;
  color: #1E3A5F;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.11em;
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
    radial-gradient(circle at 88% 42%, color-mix(in srgb, var(--mc) 12%, transparent), transparent 52%),
    linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.54));
  box-shadow: 0 10px 24px rgba(15,42,20,0.065), 0 1px 0 rgba(255,255,255,0.92) inset;
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

/* Force all CSS animations to keep running during scroll */
.ps-orb__shell,
.ps-orb__shimmer,
.ps-orb__ring,
.ps-orb__energy {
  animation-play-state: running !important;
}
.ps-flow__sharp,
.ps-flow__highlight {
  animation-play-state: running !important;
}

/* ── orb keyframes ── */
@keyframes ps-orb-breathe {
  0%, 100% { transform: scale(1); opacity: 0.98; }
  50% { transform: scale(1.006); opacity: 1; }
}
@keyframes ps-orb-glass-drift {
  0%, 100% { transform: translate3d(-1px,1px,0) scale(1); opacity: 0.66; }
  50% { transform: translate3d(2px,-2px,0) scale(1.01); opacity: 0.78; }
}
@keyframes ps-orb-ring-pulse {
  0%, 100% { opacity: 0.40; transform: scale(0.98); }
  50% { opacity: 0.80; transform: scale(1.02); }
}
@keyframes ps-orb-energy-drift {
  0%, 100% { transform: translate3d(-7%,2%,0); opacity: 0.25; }
  50% { transform: translate3d(7%,-2%,0); opacity: 0.42; }
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
