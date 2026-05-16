import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { TEMPLATE_META } from '../mockData.js';

const TEMPLATE_DEFS = [
  { key: 'ag',  dataKey: 'ag',  notesVal: 'ag',  ...TEMPLATE_META.ag  },
  { key: 'na',  dataKey: 'na',  notesVal: 'na',  ...TEMPLATE_META.na  },
  { key: 'rit', dataKey: 'rit', notesVal: 'rit', ...TEMPLATE_META.rit },
  { key: 'tm',  dataKey: 'tm',  notesVal: 't/m', ...TEMPLATE_META.tm  },
  { key: 'iq',  dataKey: 'iq',  notesVal: 'iq',  ...TEMPLATE_META.iq  },
];

// ── Donut geometry ────────────────────────────────────────────────────────────
const CX     = 100;
const CY     = 100;
const RO     = 80;          // outer radius
const RI     = 60;          // inner radius — thinner ring (was 46)
const MID_R  = (RO + RI) / 2; // midpoint of band = 70
const GAP    = 2.5;         // gap between segments (degrees)
const EXPLODE = 9;          // px outward on hover

const toRad = d => (d * Math.PI) / 180;

function arcPt(r, a) {
  return `${CX + r * Math.cos(toRad(a))} ${CY + r * Math.sin(toRad(a))}`;
}

// Full donut arc segment path
function donutPath(a1, a2) {
  const large = a2 - a1 > 180 ? 1 : 0;
  return [
    `M ${arcPt(RO, a1)}`,
    `A ${RO} ${RO} 0 ${large} 1 ${arcPt(RO, a2)}`,
    `L ${arcPt(RI, a2)}`,
    `A ${RI} ${RI} 0 ${large} 0 ${arcPt(RI, a1)}`,
    'Z',
  ].join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PipelineSummaryChart({ byTemplate = {} }) {
  const navigate = useNavigate();

  const [hovered,      setHovered]      = useState(null);
  const [lastSeg,      setLastSeg]      = useState(null);
  const [mounted,      setMounted]      = useState(false); // entrance: opacity 0→1
  const [ready,        setReady]        = useState(false); // after entrance: instant hover opacity
  const [chartHovered, setChartHovered] = useState(false); // subtle lift on chart hover

  const total = Object.values(byTemplate).reduce((a, b) => a + b, 0);

  const segments = useMemo(() => {
    let cum = -90;
    return TEMPLATE_DEFS
      .map(d => ({
        ...d,
        count: byTemplate[d.dataKey] ?? 0,
        pct: total > 0 ? Math.round(((byTemplate[d.dataKey] ?? 0) / total) * 100) : 0,
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .map(s => {
        const sweep = (s.pct / 100) * 360;
        const a1  = cum + GAP;
        const a2  = cum + sweep - GAP;
        const mid = cum + sweep / 2;
        cum += sweep;
        return { ...s, a1, a2, mid };
      });
  }, [byTemplate, total]);

  // Track last hovered segment so center text fades out gracefully
  useEffect(() => {
    if (hovered) {
      const s = segments.find(s => s.key === hovered);
      if (s) setLastSeg(s);
    }
  }, [hovered, segments]);

  // Entrance animation: one frame delay to start from opacity 0
  useEffect(() => {
    const f = requestAnimationFrame(() => setMounted(true));
    // After entrance completes (~650 ms), switch to instant hover transitions
    const t = setTimeout(() => setReady(true), 700);
    return () => { cancelAnimationFrame(f); clearTimeout(t); };
  }, []);

  const hovSeg   = hovered ? segments.find(s => s.key === hovered) ?? null : null;
  const isAnyHov = hovSeg !== null;
  const goTo     = seg => navigate(`/leads?notes=${encodeURIComponent(seg.notesVal)}`);

  return (
    <div>
      {/* ── Chart ── */}
      <div style={{ padding: '10px 20px 4px', display: 'flex', justifyContent: 'center' }}>
        <motion.div
          key={JSON.stringify(byTemplate)}
          initial={{ opacity: 0, scale: 0.88, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: chartHovered ? -3 : 0 }}
          transition={{
            opacity: { duration: 0.5, ease: 'easeOut' },
            scale:   { type: 'spring', stiffness: 200, damping: 22, delay: 0.04 },
            y:       { type: 'spring', stiffness: 260, damping: 26 },
          }}
          style={{ width: '100%', maxWidth: 194 }}
          onMouseEnter={() => setChartHovered(true)}
          onMouseLeave={() => setChartHovered(false)}
        >
          <svg
            viewBox="0 0 200 200"
            style={{
              width: '100%', height: 'auto', overflow: 'visible',
              filter: chartHovered
                ? 'drop-shadow(0 10px 28px rgba(0,0,0,0.13)) drop-shadow(0 3px 8px rgba(0,0,0,0.07))'
                : 'drop-shadow(0 5px 18px rgba(0,0,0,0.09)) drop-shadow(0 2px 5px rgba(0,0,0,0.05))',
              transition: 'filter 0.3s ease',
            }}
          >
            <defs>
              {/* Top-lit depth gradient — lighter at top, darker at bottom, simulates 3D curvature */}
              <linearGradient id="ps-depth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="white" stopOpacity="0.38" />
                <stop offset="25%"  stopColor="white" stopOpacity="0.10" />
                <stop offset="58%"  stopColor="black" stopOpacity="0.00" />
                <stop offset="100%" stopColor="black" stopOpacity="0.22" />
              </linearGradient>

              {/* Specular highlight gradient — bright at top, fades downward */}
              <linearGradient id="ps-spec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="white" stopOpacity="0.50" />
                <stop offset="55%"  stopColor="white" stopOpacity="0.08" />
                <stop offset="100%" stopColor="white" stopOpacity="0.00" />
              </linearGradient>

              {/* Ring band mask: shows only the ring area between RI and RO */}
              <mask id="ps-ringMask">
                <circle cx={CX} cy={CY} r={RO - 0.5}  fill="white" />
                <circle cx={CX} cy={CY} r={RI + 0.5}  fill="black" />
              </mask>

              {/* Outer half-band mask: shows only the outer half of the ring band */}
              <mask id="ps-outerMask">
                <circle cx={CX} cy={CY} r={RO - 0.5}    fill="white" />
                <circle cx={CX} cy={CY} r={MID_R + 0.5} fill="black" />
              </mask>
            </defs>

            {/* ── Ambient outer glow ring ── */}
            <circle
              cx={CX} cy={CY} r={RO + 4}
              fill="none" stroke="rgba(22,163,74,0.09)" strokeWidth="10"
              style={{ filter: 'blur(6px)' }}
            />

            {/* ── Colored donut segments ── */}
            {segments.map((seg, idx) => {
              const isHov  = hovered === seg.key;
              const tx     = isHov ? EXPLODE * Math.cos(toRad(seg.mid)) : 0;
              const ty     = isHov ? EXPLODE * Math.sin(toRad(seg.mid)) : 0;
              const segOpacity = !mounted ? 0 : (isAnyHov && !isHov ? 0.26 : 1);
              const segTransition = ready
                ? 'opacity 0.22s ease, filter 0.22s ease'
                : `opacity 0.38s ease ${0.14 + idx * 0.10}s, filter 0.22s ease`;

              return (
                <motion.g
                  key={seg.key}
                  animate={{ x: tx, y: ty }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHovered(seg.key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => goTo(seg)}
                >
                  <path
                    d={donutPath(seg.a1, seg.a2)}
                    fill={seg.color}
                    style={{
                      opacity: segOpacity,
                      filter: isHov ? `drop-shadow(0 5px 14px ${seg.color}70)` : 'none',
                      transition: segTransition,
                    }}
                  />
                </motion.g>
              );
            })}

            {/* ── Depth gradient overlay — top-lit 3D effect across entire ring ── */}
            <rect
              x="0" y="0" width="200" height="200"
              fill="url(#ps-depth)"
              mask="url(#ps-ringMask)"
              style={{ pointerEvents: 'none' }}
            />

            {/* ── Specular highlight — outer band at top of ring ── */}
            <rect
              x="0" y="0" width="200" height="200"
              fill="url(#ps-spec)"
              mask="url(#ps-outerMask)"
              style={{ pointerEvents: 'none' }}
            />

            {/* ── Outer edge definition line ── */}
            <circle cx={CX} cy={CY} r={RO}
              fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5"
              style={{ pointerEvents: 'none' }} />

            {/* ── Inner edge shadow — separates ring from center ── */}
            <circle cx={CX} cy={CY} r={RI + 1}
              fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="3"
              style={{ pointerEvents: 'none' }} />
            <circle cx={CX} cy={CY} r={RI - 1}
              fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="2"
              style={{ pointerEvents: 'none' }} />

            {/* ── Center hole fill ── */}
            <circle cx={CX} cy={CY} r={RI - 2.5} fill="white" style={{ pointerEvents: 'none' }} />

            {/* ── Center text: default (total count) ── */}
            <g style={{ opacity: isAnyHov ? 0 : 1, transition: 'opacity 0.18s ease', pointerEvents: 'none' }}>
              <text
                x={CX} y={CY - 5}
                textAnchor="middle" fill="#0F172A" fontSize={25} fontWeight={800}
                fontFamily="Poppins, Inter, sans-serif"
              >
                {total}
              </text>
              <text
                x={CX} y={CY + 12}
                textAnchor="middle" fill="#64748B" fontSize={8.5} fontWeight={500}
              >
                Total Leads
              </text>
            </g>

            {/* ── Center text: hovered segment detail ── */}
            {lastSeg && (
              <g style={{ opacity: isAnyHov ? 1 : 0, transition: 'opacity 0.18s ease', pointerEvents: 'none' }}>
                <text
                  x={CX} y={CY - 22}
                  textAnchor="middle" fill={lastSeg.color} fontSize={10.5} fontWeight={800}
                  letterSpacing="0.06em"
                >
                  {lastSeg.label}
                </text>
                <text x={CX} y={CY - 9} textAnchor="middle" fill="#334155" fontSize={7.5} fontWeight={600}>
                  {lastSeg.fullLabel}
                </text>
                <text
                  x={CX} y={CY + 9}
                  textAnchor="middle" fill="#0F172A" fontSize={21} fontWeight={800}
                  fontFamily="Poppins, Inter, sans-serif"
                >
                  {lastSeg.count}
                </text>
                <text x={CX} y={CY + 23} textAnchor="middle" fill="#64748B" fontSize={8}>
                  {lastSeg.pct}% of total
                </text>
              </g>
            )}
          </svg>
        </motion.div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '2px 20px 0' }} />

      {/* ── Legend ── */}
      <div style={{ padding: '7px 14px 9px', display: 'flex', flexDirection: 'column' }}>
        {TEMPLATE_DEFS.map(def => {
          const meta     = TEMPLATE_META[def.key];
          const count    = byTemplate[def.dataKey] ?? 0;
          const pct      = total > 0 ? Math.round((count / total) * 100) : 0;
          const canClick = count > 0;
          const isHov    = hovered === def.key;

          return (
            <button
              key={def.key}
              onClick={() => canClick && navigate(`/leads?notes=${encodeURIComponent(def.notesVal)}`)}
              onMouseEnter={() => canClick && setHovered(def.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '4px 6px', borderRadius: 6,
                cursor: canClick ? 'pointer' : 'default',
                background: isHov ? meta.bg : 'none',
                border: 'none', width: '100%', textAlign: 'left',
                opacity: count === 0 ? 0.4 : 1,
                transition: 'background 0.14s ease',
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: meta.color, flexShrink: 0,
                boxShadow: isHov ? `0 0 6px ${meta.color}80` : 'none',
                transition: 'box-shadow 0.14s ease',
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: meta.textColor, minWidth: 24, flexShrink: 0 }}>
                {meta.label}
              </span>
              <span style={{ fontSize: 10, color: '#64748B', flex: 1 }}>
                {meta.fullLabel}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: count > 0 ? meta.textColor : '#CBD5E1', flexShrink: 0 }}>
                {count}
              </span>
              <span style={{ fontSize: 9, color: '#94A3B8', minWidth: 26, textAlign: 'right', flexShrink: 0 }}>
                {pct}%
              </span>
              {canClick && <ArrowUpRight size={9} style={{ color: '#94A3B8', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
