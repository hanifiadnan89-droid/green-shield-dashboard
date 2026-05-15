import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { TEMPLATE_META } from '../mockData.js';

const DEFS = [
  { key: 'ag',  dataKey: 'ag',  notesVal: 'ag',  ...TEMPLATE_META.ag  },
  { key: 'na',  dataKey: 'na',  notesVal: 'na',  ...TEMPLATE_META.na  },
  { key: 'rit', dataKey: 'rit', notesVal: 'rit', ...TEMPLATE_META.rit },
  { key: 'tm',  dataKey: 'tm',  notesVal: 't/m', ...TEMPLATE_META.tm  },
  { key: 'iq',  dataKey: 'iq',  notesVal: 'iq',  ...TEMPLATE_META.iq  },
];

// Geometry — sized to match original widget footprint
const CX = 100, CY = 62;
const RX = 70,  RY = 28;
const DEPTH = 11;

// Explode distances
const E_CLOSED = 1;   // default: almost no separation (closed pie)
const E_OPEN   = 15;  // chart hovered: slices spread out
const E_HOV    = 24;  // individual segment hovered: pops furthest

// Staircase step height (per sort index, activates only when chart is hovered)
const STEP = 10;

const toRad = d => (d * Math.PI) / 180;
const ePt   = deg => [CX + RX * Math.cos(toRad(deg)), CY + RY * Math.sin(toRad(deg))];

function sectorD(a1, a2) {
  const [sx, sy] = ePt(a1);
  const [ex, ey] = ePt(a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${sx} ${sy} A ${RX} ${RY} 0 ${large} 1 ${ex} ${ey} Z`;
}

// Outer-arc depth face — only the front-facing portion (angles 0°–180°)
function depthD(a1, a2) {
  const va1 = Math.max(a1, 0), va2 = Math.min(a2, 180);
  if (va1 >= va2) return null;
  const [sx, sy] = ePt(va1);
  const [ex, ey] = ePt(va2);
  const large = va2 - va1 > 180 ? 1 : 0;
  return (
    `M ${sx} ${sy} ` +
    `A ${RX} ${RY} 0 ${large} 1 ${ex} ${ey} ` +
    `L ${ex} ${ey + DEPTH} ` +
    `A ${RX} ${RY} 0 ${large} 0 ${sx} ${sy + DEPTH} Z`
  );
}

// Radial side wall (visible cut face at a radial edge)
function wallD(angle) {
  if (angle <= 0 || angle >= 180) return null;
  const [ox, oy] = ePt(angle);
  return `M ${CX} ${CY} L ${ox} ${oy} L ${ox} ${oy + DEPTH} L ${CX} ${CY + DEPTH} Z`;
}

function darken(hex, by = 44) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - by);
  const g = Math.max(0, ((n >> 8) & 0xff) - by);
  const b = Math.max(0, (n & 0xff) - by);
  return `rgb(${r},${g},${b})`;
}

export default function PipelineSummaryChart({ byTemplate = {} }) {
  const navigate = useNavigate();
  const [hovered,  setHovered]  = useState(null);
  const [chartHov, setChartHov] = useState(false);

  const total = Object.values(byTemplate).reduce((a, b) => a + b, 0);

  const segments = useMemo(() => {
    let cum = -90;
    return DEFS
      .map(d => ({
        ...d,
        count: byTemplate[d.dataKey] ?? 0,
        pct: total > 0 ? Math.round(((byTemplate[d.dataKey] ?? 0) / total) * 100) : 0,
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((s, i) => {
        const sweep = (s.pct / 100) * 360;
        const a1 = cum, a2 = cum + sweep, mid = cum + sweep / 2;
        cum = a2;
        return { ...s, a1, a2, mid, idx: i };
      });
  }, [byTemplate, total]);

  // x/y target for each slice's motion.g
  // • Closed  (no hover): barely separated, no staircase — flat compact pie
  // • Open    (chart hovered): spreads outward + staircase rises — spirals up
  // • Popped  (segment hovered): that slice pops furthest
  function getXY(seg) {
    const isHov = hovered === seg.key;
    const dist  = isHov ? E_HOV : chartHov ? E_OPEN : E_CLOSED;
    const ex    = dist * Math.cos(toRad(seg.mid));
    const ey    = dist * (RY / RX) * Math.sin(toRad(seg.mid));
    // Staircase only active when chart is open
    const stair = chartHov ? seg.idx * STEP : 0;
    return { x: ex, y: ey - stair };
  }

  // Back-to-front render order; hovered slice always on top
  const renderOrder = useMemo(() => {
    const order = [...segments].sort((a, b) => {
      const ay = RY * Math.sin(toRad(a.mid));
      const by = RY * Math.sin(toRad(b.mid));
      return ay - by;
    });
    if (hovered) {
      const i = order.findIndex(s => s.key === hovered);
      if (i !== -1) order.push(order.splice(i, 1)[0]);
    }
    return order;
  }, [segments, hovered]);

  const goTo = seg => navigate(`/leads?notes=${encodeURIComponent(seg.notesVal)}`);

  return (
    <div>
      {/* 3D Pie */}
      <div style={{ padding: '10px 14px 4px' }}>
        <svg
          viewBox="-6 -10 206 128"
          style={{ width: '100%', height: 'auto', overflow: 'visible' }}
          onMouseEnter={() => setChartHov(true)}
          onMouseLeave={() => { setChartHov(false); setHovered(null); }}
        >
          {renderOrder.map(seg => {
            const { x: tx, y: ty } = getXY(seg);
            const isHov = hovered === seg.key;
            const dark  = darken(seg.color, 42);
            const mid2  = darken(seg.color, 18);
            const dp    = depthD(seg.a1, seg.a2);
            const lw    = wallD(seg.a1);
            const rw    = wallD(seg.a2);
            const sp    = sectorD(seg.a1, seg.a2);
            const lx    = CX + RX * 0.56 * Math.cos(toRad(seg.mid));
            const ly    = CY + RY * 0.56 * Math.sin(toRad(seg.mid));

            return (
              <motion.g
                key={seg.key}
                animate={{ x: tx, y: ty }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered(seg.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => goTo(seg)}
              >
                {/* Depth faces (drawn beneath top face) */}
                {lw && <path d={lw} fill={dark} opacity={0.55} />}
                {rw && <path d={rw} fill={dark} opacity={0.55} />}
                {dp && <path d={dp} fill={mid2} opacity={0.85} />}

                {/* Top face */}
                <path
                  d={sp}
                  fill={seg.color}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={1.5}
                  opacity={isHov ? 1 : 0.93}
                  style={{
                    filter: isHov
                      ? `drop-shadow(0 4px 10px ${seg.color}70)`
                      : `drop-shadow(0 1px 3px ${seg.color}28)`,
                    transition: 'filter 0.18s ease, opacity 0.18s ease',
                  }}
                />

                {/* Label inside slice — only for slices ≥ 14% */}
                {seg.pct >= 14 && (
                  <>
                    <text
                      x={lx} y={ly - 3}
                      textAnchor="middle"
                      fill="white"
                      fontSize={8.5}
                      fontWeight={800}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {seg.label}
                    </text>
                    <text
                      x={lx} y={ly + 6}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.78)"
                      fontSize={7.5}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {seg.pct}%
                    </text>
                  </>
                )}
              </motion.g>
            );
          })}

          {/* Tooltip above hovered segment */}
          {hovered && (() => {
            const seg = segments.find(s => s.key === hovered);
            if (!seg) return null;
            const { x: tx, y: ty } = getXY(seg);
            const cx = CX + tx, cy = CY + ty - RY - 18;
            const w = 100, h = 38;
            return (
              <g key="tt" style={{ pointerEvents: 'none' }}>
                <rect x={cx - w / 2} y={cy - h} width={w} height={h} rx={6} fill="#0F172A" opacity={0.94} />
                <polygon points={`${cx - 5},${cy} ${cx + 5},${cy} ${cx},${cy + 5}`} fill="#0F172A" opacity={0.94} />
                <text x={cx} y={cy - h + 10} textAnchor="middle" fill={seg.color} fontSize={10} fontWeight={800}>{seg.label}</text>
                <text x={cx} y={cy - h + 21} textAnchor="middle" fill="#94A3B8" fontSize={8.5}>{seg.fullLabel}</text>
                <text x={cx} y={cy - h + 32} textAnchor="middle" fill="#F1F5F9" fontSize={8.5} fontWeight={600}>
                  {seg.count} lead{seg.count !== 1 ? 's' : ''} · {seg.pct}%
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '0 20px' }} />

      {/* Legend */}
      <div style={{ padding: '7px 14px 8px', display: 'flex', flexDirection: 'column' }}>
        {segments.map(seg => (
          <button
            key={seg.key}
            onClick={() => goTo(seg)}
            onMouseEnter={() => setHovered(seg.key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '4px 6px',
              borderRadius: 6,
              cursor: 'pointer',
              background: hovered === seg.key ? seg.bg : 'none',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              transition: 'background 0.14s ease',
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: seg.textColor, minWidth: 24, flexShrink: 0 }}>{seg.label}</span>
            <span style={{ fontSize: 10, color: '#64748B', flex: 1 }}>{seg.fullLabel}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: seg.textColor, flexShrink: 0 }}>{seg.count}</span>
            <span style={{ fontSize: 9, color: '#94A3B8', minWidth: 26, textAlign: 'right', flexShrink: 0 }}>{seg.pct}%</span>
            <ArrowUpRight size={9} style={{ color: '#94A3B8', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
