import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, Users, MessageCircle, AlertCircle, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { TEMPLATE_META } from '../mockData.js';

const TEMPLATES = [
  { key: 'ag',  notesVal: 'ag',  ...TEMPLATE_META.ag  },
  { key: 'na',  notesVal: 'na',  ...TEMPLATE_META.na  },
  { key: 'rit', notesVal: 'rit', ...TEMPLATE_META.rit },
  { key: 'tm',  notesVal: 't/m', ...TEMPLATE_META.tm  },
  { key: 'iq',  notesVal: 'iq',  ...TEMPLATE_META.iq  },
];

const RING_DEFS = [
  { key: 'reply',  label: 'Reply Rate',  color: '#16A34A', track: '#dcfce7', r: 66, href: '/leads' },
  { key: 'active', label: 'In Progress', color: '#2563EB', track: '#dbeafe', r: 50, href: '/leads' },
  { key: 'ag',     label: 'Agreements',  color: '#D97706', track: '#fef3c7', r: 34, href: '/leads?notes=ag' },
];

// ── Concentric animated rings ───────────────────────────────────────────────
function ConcentricRings({ rates }) {
  const navigate = useNavigate();
  const CX = 80, CY = 80;
  const [mounted, setMounted] = useState(false);
  const [hov, setHov] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const hovDef = hov ? RING_DEFS.find(r => r.key === hov) : null;

  return (
    <div>
      <svg viewBox="0 0 160 160" style={{ width: '100%', maxWidth: 160, height: 'auto', overflow: 'visible' }}>
        {RING_DEFS.map(ring => {
          const circ  = 2 * Math.PI * ring.r;
          const pct   = Math.min(Math.max((rates[ring.key] ?? 0) / 100, 0), 1);
          const dash  = mounted ? circ * pct : 0;
          const isHov = hov === ring.key;
          const sw    = isHov ? 13 : 9;

          return (
            <g key={ring.key}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHov(ring.key)}
              onMouseLeave={() => setHov(null)}
              onClick={() => navigate(ring.href)}
            >
              <circle cx={CX} cy={CY} r={ring.r}
                fill="none" stroke={ring.track} strokeWidth={sw + 4}
                style={{ transition: 'stroke-width 0.18s ease' }}
              />
              <g transform={`rotate(-90 ${CX} ${CY})`}>
                <circle
                  cx={CX} cy={CY} r={ring.r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  style={{
                    transition: 'stroke-dasharray 0.9s ease, stroke-width 0.18s ease, filter 0.18s ease',
                    filter: isHov ? `drop-shadow(0 0 7px ${ring.color}80)` : 'none',
                  }}
                />
              </g>
            </g>
          );
        })}

        {hovDef ? (
          <g style={{ pointerEvents: 'none' }}>
            <text x={CX} y={CY - 7} textAnchor="middle"
              fill={hovDef.color} fontSize={22} fontWeight={800} fontFamily="Poppins, Inter, sans-serif">
              {Math.round(rates[hovDef.key] ?? 0)}%
            </text>
            <text x={CX} y={CY + 10} textAnchor="middle" fill="#64748B" fontSize={9} fontWeight={600}>
              {hovDef.label}
            </text>
          </g>
        ) : (
          <text x={CX} y={CY + 4} textAnchor="middle" fill="#CBD5E1" fontSize={9} style={{ pointerEvents: 'none' }}>
            hover ring
          </text>
        )}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
        {RING_DEFS.map(ring => {
          const isH = hov === ring.key;
          return (
            <div key={ring.key}
              role="button"
              tabIndex={0}
              onClick={() => navigate(ring.href)}
              onKeyDown={e => e.key === 'Enter' && navigate(ring.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '3px 6px', borderRadius: 6,
                background: isH ? ring.track : 'transparent',
                transition: 'background 0.15s', cursor: 'pointer',
                outline: 'none',
              }}
              onMouseEnter={() => setHov(ring.key)}
              onMouseLeave={() => setHov(null)}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: ring.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#64748B', flex: 1 }}>{ring.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: ring.color }}>
                {Math.round(rates[ring.key] ?? 0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mini donut chart ────────────────────────────────────────────────────────
const DCX = 70, DCY = 70, DRO = 55, DRI = 40, DGAP = 3;
const toRad = d => (d * Math.PI) / 180;
function dArcPt(r, a) { return `${DCX + r * Math.cos(toRad(a))} ${DCY + r * Math.sin(toRad(a))}`; }
function dDonutPath(a1, a2) {
  const large = a2 - a1 > 180 ? 1 : 0;
  return [
    `M ${dArcPt(DRO, a1)}`,
    `A ${DRO} ${DRO} 0 ${large} 1 ${dArcPt(DRO, a2)}`,
    `L ${dArcPt(DRI, a2)}`,
    `A ${DRI} ${DRI} 0 ${large} 0 ${dArcPt(DRI, a1)}`,
    'Z',
  ].join(' ');
}

function MiniDonut({ byTemplate, total }) {
  const navigate = useNavigate();
  const [hov, setHov] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const f = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(f);
  }, []);

  const segments = useMemo(() => {
    let cum = -90;
    return TEMPLATES
      .map(t => ({ ...t, count: byTemplate[t.key] ?? 0 }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .map(t => {
        const pct   = (t.count / total) * 100;
        const sweep = (t.count / total) * 360;
        const a1    = cum + DGAP;
        const a2    = cum + sweep - DGAP;
        const mid   = cum + sweep / 2;
        cum += sweep;
        return { ...t, pct, a1, a2, mid };
      });
  }, [byTemplate, total]);

  const hovSeg  = hov ? segments.find(s => s.key === hov) : null;
  const EXPLODE = 6;

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        style={{ width: 150 }}
      >
        <svg viewBox="0 0 140 140" style={{
          width: '100%', height: 'auto', overflow: 'visible',
          filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.08))',
        }}>
          <defs>
            <linearGradient id="md-depth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="white" stopOpacity="0.32" />
              <stop offset="55%"  stopColor="white" stopOpacity="0.00" />
              <stop offset="100%" stopColor="black" stopOpacity="0.15" />
            </linearGradient>
            <mask id="md-ring">
              <circle cx={DCX} cy={DCY} r={DRO - 0.5} fill="white" />
              <circle cx={DCX} cy={DCY} r={DRI + 0.5} fill="black" />
            </mask>
          </defs>

          <circle cx={DCX} cy={DCY} r={DRO + 5}
            fill="none" stroke="rgba(22,163,74,0.07)" strokeWidth="10"
            style={{ filter: 'blur(5px)' }}
          />

          {segments.map(seg => {
            const isH = hov === seg.key;
            const tx  = isH ? EXPLODE * Math.cos(toRad(seg.mid)) : 0;
            const ty  = isH ? EXPLODE * Math.sin(toRad(seg.mid)) : 0;
            return (
              <motion.g
                key={seg.key}
                animate={{ x: tx, y: ty }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHov(seg.key)}
                onMouseLeave={() => setHov(null)}
                onClick={() => navigate(`/leads?notes=${encodeURIComponent(seg.notesVal)}`)}
              >
                <path
                  d={dDonutPath(seg.a1, seg.a2)}
                  fill={seg.color}
                  style={{
                    opacity: mounted ? (hov && !isH ? 0.22 : 1) : 0,
                    transition: 'opacity 0.3s ease',
                    filter: isH ? `drop-shadow(0 3px 9px ${seg.color}70)` : 'none',
                  }}
                />
              </motion.g>
            );
          })}

          <rect x="0" y="0" width="140" height="140"
            fill="url(#md-depth)" mask="url(#md-ring)"
            style={{ pointerEvents: 'none' }}
          />

          {/* Center — clicking takes to all leads */}
          <circle cx={DCX} cy={DCY} r={DRI - 2} fill="white"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/leads')}
          />

          {hovSeg ? (
            <g style={{ pointerEvents: 'none' }}>
              <text x={DCX} y={DCY - 8} textAnchor="middle"
                fill={hovSeg.color} fontSize={8} fontWeight={800} letterSpacing="0.07em">
                {hovSeg.label}
              </text>
              <text x={DCX} y={DCY + 9} textAnchor="middle"
                fill="#0F172A" fontSize={19} fontWeight={800} fontFamily="Poppins, Inter, sans-serif">
                {hovSeg.count}
              </text>
              <text x={DCX} y={DCY + 21} textAnchor="middle" fill="#94A3B8" fontSize={7.5}>
                {Math.round(hovSeg.pct)}% of total
              </text>
            </g>
          ) : (
            <g style={{ pointerEvents: 'none' }}>
              <text x={DCX} y={DCY - 4} textAnchor="middle"
                fill="#0F172A" fontSize={21} fontWeight={800} fontFamily="Poppins, Inter, sans-serif">
                {total}
              </text>
              <text x={DCX} y={DCY + 11} textAnchor="middle" fill="#64748B" fontSize={8}>
                Total Leads
              </text>
            </g>
          )}
        </svg>
      </motion.div>
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, bg, border, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `${color}0d` : bg,
        borderRadius: 10, padding: '10px 12px',
        border: `1px solid ${hov ? color + '30' : border}`,
        display: 'flex', flexDirection: 'column', gap: 5,
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <div style={{ background: `${color}${hov ? '28' : '18'}`, borderRadius: 5, padding: 4, display: 'inline-flex', transition: 'background 0.15s' }}>
          <Icon size={10} style={{ color }} />
        </div>
      </div>
      <span style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', fontFamily: 'Poppins, Inter, sans-serif', lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

// ── Template horizontal bar row ─────────────────────────────────────────────
function TemplateBar({ def, count, total, delay = 0, onClick }) {
  const [hov, setHov] = useState(false);
  const pct   = total > 0 ? (count / total) * 100 : 0;
  const empty = count === 0;
  const canClick = !empty;

  return (
    <div
      role={canClick ? 'button' : undefined}
      tabIndex={canClick ? 0 : undefined}
      onClick={canClick ? onClick : undefined}
      onKeyDown={canClick ? (e => e.key === 'Enter' && onClick?.()) : undefined}
      onMouseEnter={() => canClick && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '3px 6px', borderRadius: 6, margin: '0 -6px',
        background: hov ? def.bg : 'transparent',
        transition: 'background 0.15s',
        cursor: canClick ? 'pointer' : 'default',
        outline: 'none',
      }}
    >
      <span style={{
        fontSize: 9, fontWeight: 700, color: def.textColor,
        width: 22, textAlign: 'right', flexShrink: 0, opacity: empty ? 0.3 : 1,
      }}>
        {def.label}
      </span>
      <span style={{ fontSize: 9.5, color: '#94A3B8', width: 92, flexShrink: 0, opacity: empty ? 0.3 : 0.85 }}>
        {def.fullLabel}
      </span>
      <div style={{ flex: 1, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: 0.12 + delay, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 4,
            background: empty ? '#e2e8f0' : def.color,
          }}
        />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 800, color: empty ? '#CBD5E1' : def.textColor,
        width: 20, textAlign: 'right', flexShrink: 0,
      }}>
        {count}
      </span>
      <span style={{ fontSize: 9, color: '#94A3B8', width: 28, textAlign: 'right', flexShrink: 0 }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────
export default function PipelineSummary({ stats = {} }) {
  const navigate = useNavigate();
  const {
    total = 0, replied = 0, inProgress = 0,
    sentToday = 0, errors = 0, byTemplate = {},
  } = stats;

  const rates = useMemo(() => ({
    reply:  total > 0 ? (replied              / total) * 100 : 0,
    active: total > 0 ? (inProgress           / total) * 100 : 0,
    ag:     total > 0 ? ((byTemplate.ag ?? 0) / total) * 100 : 0,
  }), [total, replied, inProgress, byTemplate]);

  if (total === 0) {
    return (
      <div className="p-card section-enter h-full flex flex-col items-center justify-center text-center p-8">
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12, display: 'inline-flex', marginBottom: 12 }}>
          <TrendingUp size={20} style={{ color: '#94A3B8' }} />
        </div>
        <p className="text-sm font-medium text-[#64748B]">No lead data yet</p>
        <p className="text-xs text-[#94A3B8] mt-1">
          <Link to="/send" className="text-[#16A34A] hover:underline">Send your first template</Link> to see analytics
        </p>
      </div>
    );
  }

  return (
    <div className="p-card section-enter h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div>
          <h3 className="font-heading font-semibold text-[#0F172A] text-sm">Pipeline Summary</h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Lead analytics · {total} total leads</p>
        </div>
        <Link to="/leads"
          className="flex items-center gap-1 text-xs font-medium text-[#16A34A] hover:text-[#15803d] transition-colors cursor-pointer">
          View <ArrowRight size={11} />
        </Link>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top 3-column section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 16px 14px' }}>

          {/* Col 1 — Concentric rings */}
          <div style={{ paddingRight: 14, borderRight: '1px solid rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Performance
            </p>
            <ConcentricRings rates={rates} />
          </div>

          {/* Col 2 — Mini donut */}
          <div style={{ padding: '0 14px', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Template Sources
            </p>
            <MiniDonut byTemplate={byTemplate} total={total} />
          </div>

          {/* Col 3 — Stat cards */}
          <div style={{ paddingLeft: 14 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Key Metrics
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatCard icon={Users}         label="Total"      value={total}     color="#0F172A" bg="#f8fafc"  border="rgba(0,0,0,0.06)"          onClick={() => navigate('/leads')} />
              <StatCard icon={Send}          label="Sent Today" value={sentToday} color="#2563EB" bg="#eff6ff"  border="rgba(37,99,235,0.12)"       onClick={() => navigate('/leads')} />
              <StatCard icon={MessageCircle} label="Replies"    value={replied}   color="#16A34A" bg="#f0fdf4"  border="rgba(22,163,74,0.12)"       onClick={() => navigate('/leads')} />
              <StatCard icon={AlertCircle}   label="Errors"     value={errors}    color="#DC2626" bg="#fef2f2"  border="rgba(220,38,38,0.12)"       onClick={() => navigate('/leads')} />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '0 16px' }} />

        {/* Bottom — Template distribution bars */}
        <div style={{ padding: '13px 20px 18px', flex: 1 }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 11 }}>
            Template Distribution
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TEMPLATES.map((def, i) => (
              <TemplateBar
                key={def.key}
                def={def}
                count={byTemplate[def.key] ?? 0}
                total={total}
                delay={i * 0.09}
                onClick={() => navigate(`/leads?notes=${encodeURIComponent(def.notesVal)}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
