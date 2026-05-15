import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { TEMPLATE_META } from '../mockData.js';

const SEGMENT_DEFS = [
  { key: 'ag',  dataKey: 'ag',  notesVal: 'ag',  ...TEMPLATE_META.ag  },
  { key: 'na',  dataKey: 'na',  notesVal: 'na',  ...TEMPLATE_META.na  },
  { key: 'rit', dataKey: 'rit', notesVal: 'rit', ...TEMPLATE_META.rit },
  { key: 'tm',  dataKey: 'tm',  notesVal: 't/m', ...TEMPLATE_META.tm  },
  { key: 'iq',  dataKey: 'iq',  notesVal: 'iq',  ...TEMPLATE_META.iq  },
];

function getY(index, hoveredIndex) {
  if (hoveredIndex === -1) return 0;
  if (index === hoveredIndex) return -12;
  if (index < hoveredIndex) {
    const dist = hoveredIndex - index;
    return -Math.max(0, 7 - dist * 3);
  }
  return Math.min((index - hoveredIndex) * 2, 5);
}

export default function PipelineSummaryChart({ byTemplate = {} }) {
  const navigate = useNavigate();
  const [hoveredKey, setHoveredKey] = useState(null);

  const templateTotal = Object.values(byTemplate).reduce((a, b) => a + b, 0);

  const segments = SEGMENT_DEFS
    .map(s => ({
      ...s,
      count: byTemplate[s.dataKey] ?? 0,
      pct: templateTotal > 0 ? Math.round(((byTemplate[s.dataKey] ?? 0) / templateTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const hoveredIndex = hoveredKey !== null ? segments.findIndex(s => s.key === hoveredKey) : -1;

  function handleClick(seg) {
    navigate(`/leads?notes=${encodeURIComponent(seg.notesVal)}`);
  }

  return (
    <div>
      {/* Stair-step chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '16px 20px 14px' }}>
        {segments.map((seg, index) => {
          const isHovered = hoveredKey === seg.key;
          const widthPct = Math.max(seg.pct, seg.count > 0 ? 10 : 0);
          if (widthPct === 0) return null;

          return (
            <div key={seg.key} style={{ position: 'relative' }}>
              {/* Tooltip */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.94 }}
                    transition={{ duration: 0.13, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: 0,
                      background: '#0F172A',
                      borderRadius: 9,
                      padding: '7px 11px',
                      fontSize: 11,
                      zIndex: 40,
                      pointerEvents: 'none',
                      boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
                      minWidth: 120,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: seg.color, fontSize: 12, letterSpacing: '0.03em' }}>
                      {seg.label}
                    </div>
                    <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 1, marginBottom: 5 }}>
                      {seg.fullLabel}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#F1F5F9', fontWeight: 600, fontSize: 11 }}>
                        {seg.count} lead{seg.count !== 1 ? 's' : ''}
                      </span>
                      <span style={{
                        background: seg.color + '28',
                        color: seg.color,
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: 4,
                      }}>
                        {seg.pct}%
                      </span>
                    </div>
                    {/* Arrow */}
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 16,
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: '5px solid #0F172A',
                    }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated slab */}
              <motion.div
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => handleClick(seg)}
                animate={{ y: getY(index, hoveredIndex) }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                style={{ width: `${widthPct}%`, cursor: 'pointer', willChange: 'transform' }}
              >
                {/* Top face */}
                <div style={{
                  background: isHovered
                    ? `linear-gradient(135deg, ${seg.color}26 0%, ${seg.color}16 100%)`
                    : `linear-gradient(135deg, ${seg.color}13 0%, ${seg.color}08 100%)`,
                  border: `1.5px solid ${seg.color}${isHovered ? '50' : '28'}`,
                  borderRadius: 9,
                  padding: '7px 11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  transition: 'background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease',
                  boxShadow: isHovered
                    ? `0 10px 30px ${seg.color}28, 0 3px 10px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,0.65)`
                    : `0 2px 6px ${seg.color}12, 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)`,
                }}>
                  {/* Glowing dot */}
                  <div style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: seg.color,
                    flexShrink: 0,
                    boxShadow: isHovered ? `0 0 8px ${seg.color}90` : 'none',
                    transition: 'box-shadow 0.22s ease',
                  }} />

                  {/* Code */}
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isHovered ? seg.textColor : '#1E293B',
                    flexShrink: 0,
                    letterSpacing: '0.03em',
                    transition: 'color 0.22s ease',
                  }}>
                    {seg.label}
                  </span>

                  <div style={{ flex: 1 }} />

                  {/* Count badge */}
                  <span style={{
                    background: isHovered ? seg.color + '22' : seg.bg,
                    color: seg.textColor,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: 999,
                    flexShrink: 0,
                    transition: 'background 0.22s ease',
                  }}>
                    {seg.count}
                  </span>

                  {/* Pct */}
                  <span style={{
                    fontSize: 10,
                    color: '#94A3B8',
                    fontWeight: 600,
                    flexShrink: 0,
                    minWidth: 26,
                    textAlign: 'right',
                  }}>
                    {seg.pct}%
                  </span>
                </div>

                {/* 3D depth edge */}
                <div style={{
                  height: isHovered ? 5 : 3,
                  background: `linear-gradient(90deg, ${seg.color}45 0%, ${seg.color}20 100%)`,
                  borderRadius: '0 0 6px 6px',
                  marginLeft: 8,
                  marginRight: 8,
                  opacity: isHovered ? 1 : 0.65,
                  transition: 'height 0.22s ease, opacity 0.22s ease',
                }} />
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.055)', margin: '0 20px' }} />

      {/* Legend */}
      <div style={{ padding: '10px 14px 8px', display: 'flex', flexDirection: 'column' }}>
        {segments.map(seg => (
          <button
            key={seg.key}
            onClick={() => handleClick(seg)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 6px',
              borderRadius: 7,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              width: '100%',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = seg.bg; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: seg.color,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: seg.textColor, flexShrink: 0, minWidth: 24 }}>
              {seg.label}
            </span>
            <span style={{ fontSize: 10, color: '#64748B', flex: 1 }}>
              {seg.fullLabel}
            </span>
            <span style={{ fontSize: 9, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              View <ArrowUpRight size={9} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
