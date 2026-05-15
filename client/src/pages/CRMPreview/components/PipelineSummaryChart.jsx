import { useState, useMemo, useEffect } from 'react';
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

// Donut geometry
const CX = 100, CY = 100;  // SVG center
const RO = 80;              // outer radius
const RI = 46;              // inner radius (hole)
const GAP = 2.8;            // degrees trimmed from each side of each segment
const EXPLODE = 9;          // px outward on hover

const toRad = d => (d * Math.PI) / 180;

// Build SVG path for one donut arc segment
function donutPath(a1, a2) {
  const p = (r, a) => `${CX + r * Math.cos(toRad(a))} ${CY + r * Math.sin(toRad(a))}`;
  const large = a2 - a1 > 180 ? 1 : 0;
  return [
    `M ${p(RO, a1)}`,
    `A ${RO} ${RO} 0 ${large} 1 ${p(RO, a2)}`,
    `L ${p(RI, a2)}`,
    `A ${RI} ${RI} 0 ${large} 0 ${p(RI, a1)}`,
    'Z',
  ].join(' ');
}

export default function PipelineSummaryChart({ byTemplate = {} }) {
  const navigate   = useNavigate();
  const [hovered,  setHovered]  = useState(null);  // currently hovered key
  const [lastSeg,  setLastSeg]  = useState(null);  // last hovered segment (for center fade-out)

  const total = Object.values(byTemplate).reduce((a, b) => a + b, 0);

  const segments = useMemo(() => {
    let cum = -90; // start at 12 o'clock
    return DEFS
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

  // Keep lastSeg populated so center text doesn't vanish during fade-out
  useEffect(() => {
    if (hovered) {
      const s = segments.find(s => s.key === hovered);
      if (s) setLastSeg(s);
    }
  }, [hovered, segments]);

  const hovSeg    = hovered ? segments.find(s => s.key === hovered) ?? null : null;
  const isAnyHov  = hovSeg !== null;
  const goTo      = seg => navigate(`/leads?notes=${encodeURIComponent(seg.notesVal)}`);

  return (
    <div>
      {/* Donut chart */}
      <div style={{ padding: '10px 20px 4px', display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox="0 0 200 200"
          style={{ width: '100%', maxWidth: 194, height: 'auto', overflow: 'visible' }}
        >
          {/* Subtle ring shadow behind segments */}
          <circle cx={CX} cy={CY} r={RO + 1} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={3} />
          {/* Center hole fill */}
          <circle cx={CX} cy={CY} r={RI - 0.5} fill="white" />
          {/* Thin center ring border */}
          <circle cx={CX} cy={CY} r={RI} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={1} />

          {/* Donut segments */}
          {segments.map(seg => {
            const isHov = hovered === seg.key;
            const tx = isHov ? EXPLODE * Math.cos(toRad(seg.mid)) : 0;
            const ty = isHov ? EXPLODE * Math.sin(toRad(seg.mid)) : 0;
            // Label anchor: midpoint radius, midpoint angle
            const midR = (RO + RI) / 2;
            const lx   = CX + midR * Math.cos(toRad(seg.mid));
            const ly   = CY + midR * Math.sin(toRad(seg.mid));

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
                {/* Segment arc */}
                <path
                  d={donutPath(seg.a1, seg.a2)}
                  fill={seg.color}
                  opacity={isAnyHov && !isHov ? 0.32 : 1}
                  style={{
                    filter: isHov
                      ? `drop-shadow(0 5px 14px ${seg.color}68)`
                      : 'none',
                    transition: 'opacity 0.22s ease, filter 0.22s ease',
                  }}
                />
                {/* Inline label (code + %) — only for large-enough slices */}
                {seg.pct >= 15 && (
                  <g style={{ pointerEvents: 'none' }}>
                    <text
                      x={lx} y={ly - 4}
                      textAnchor="middle"
                      fill="white"
                      fontSize={8.5}
                      fontWeight={800}
                      letterSpacing="0.05em"
                      opacity={isAnyHov && !isHov ? 0 : 0.95}
                      style={{ transition: 'opacity 0.22s ease' }}
                    >
                      {seg.label}
                    </text>
                    <text
                      x={lx} y={ly + 6}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.78)"
                      fontSize={7.5}
                      opacity={isAnyHov && !isHov ? 0 : 1}
                      style={{ transition: 'opacity 0.22s ease' }}
                    >
                      {seg.pct}%
                    </text>
                  </g>
                )}
              </motion.g>
            );
          })}

          {/* ── Center panel ── */}
          {/* Default: total count */}
          <g
            style={{
              opacity: isAnyHov ? 0 : 1,
              transition: 'opacity 0.18s ease',
              pointerEvents: 'none',
            }}
          >
            <text
              x={CX} y={CY - 7}
              textAnchor="middle"
              fill="#0F172A"
              fontSize={23}
              fontWeight={800}
              fontFamily="Poppins, Inter, sans-serif"
            >
              {total}
            </text>
            <text
              x={CX} y={CY + 10}
              textAnchor="middle"
              fill="#64748B"
              fontSize={8.5}
              fontWeight={500}
            >
              Total Leads
            </text>
          </g>

          {/* Hover: segment detail */}
          {lastSeg && (
            <g
              style={{
                opacity: isAnyHov ? 1 : 0,
                transition: 'opacity 0.18s ease',
                pointerEvents: 'none',
              }}
            >
              <text
                x={CX} y={CY - 21}
                textAnchor="middle"
                fill={lastSeg.color}
                fontSize={10.5}
                fontWeight={800}
                letterSpacing="0.06em"
              >
                {lastSeg.label}
              </text>
              <text
                x={CX} y={CY - 9}
                textAnchor="middle"
                fill="#334155"
                fontSize={7.5}
                fontWeight={600}
              >
                {lastSeg.fullLabel}
              </text>
              <text
                x={CX} y={CY + 8}
                textAnchor="middle"
                fill="#0F172A"
                fontSize={19}
                fontWeight={800}
                fontFamily="Poppins, Inter, sans-serif"
              >
                {lastSeg.count}
              </text>
              <text
                x={CX} y={CY + 21}
                textAnchor="middle"
                fill="#64748B"
                fontSize={8}
              >
                {lastSeg.pct}% of total
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '2px 20px 0' }} />

      {/* Legend — all 5 rows, zeros dimmed */}
      <div style={{ padding: '7px 14px 9px', display: 'flex', flexDirection: 'column' }}>
        {DEFS.map(def => {
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
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '4px 6px',
                borderRadius: 6,
                cursor: canClick ? 'pointer' : 'default',
                background: isHov ? meta.bg : 'none',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                opacity: count === 0 ? 0.4 : 1,
                transition: 'background 0.14s ease',
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: meta.color,
                flexShrink: 0,
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
              {canClick && (
                <ArrowUpRight size={9} style={{ color: '#94A3B8', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
