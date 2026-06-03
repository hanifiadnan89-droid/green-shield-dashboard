import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowUpRight, TrendingUp, MessageSquare, Send, AlertTriangle,
  Clock, Users, Zap,
} from 'lucide-react';
import AnimatedNumber from './AnimatedNumber.jsx';
import { derivePipelineDashboard } from './derivePipelineDashboard.js';
import { getAvatarStyle, getInitials } from '../../mockData.js';
import './pipeline-command.css';

const STAGGER = 0.05;
const EASE = [0.22, 1, 0.36, 1];

const ACTIVITY_ICONS = {
  reply: MessageSquare,
  sent: Send,
  followup: Clock,
  error: AlertTriangle,
};

function MotionCard({ children, className = '', delay = 0, onClick }) {
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`pipeline-command__card ${className}`.trim()}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onClick={onClick}
      style={onClick ? { textAlign: 'left', width: '100%', cursor: 'pointer' } : undefined}
    >
      {children}
    </Tag>
  );
}

function StatusDonut({ segments, total }) {
  const size = 180;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="pipeline-command__donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="pipeline-ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {segments.map((seg, i) => {
          const pct = total > 0 ? seg.count / total : 0;
          const dash = pct * c;
          const prevPct = segments
            .slice(0, i)
            .reduce((sum, s) => sum + (total > 0 ? s.count / total : 0), 0);
          const rotate = -90 + prevPct * 360;
          return (
            <motion.circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${dash} ${c - dash}`}
              transform={`rotate(${rotate} ${size / 2} ${size / 2})`}
              initial={{ strokeDasharray: `0 ${c}` }}
              animate={{ strokeDasharray: `${dash} ${c - dash}` }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.7, ease: EASE }}
              style={{ filter: `drop-shadow(0 0 6px ${seg.color}55)` }}
            />
          );
        })}
      </svg>
      <div className="pipeline-command__donut-center">
        <strong>
          <AnimatedNumber value={total} />
        </strong>
        <span>Total leads</span>
      </div>
    </div>
  );
}

function Sparkline({ points, max }) {
  const w = 320;
  const h = 72;
  const pad = 4;
  if (!points.length) return null;

  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (p.count / max) * (h - pad * 2);
    return { x, y, ...p };
  });

  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaD = `${lineD} L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`;

  return (
    <svg className="pipeline-command__sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(74,222,128,0.35)" />
          <stop offset="100%" stopColor="rgba(74,222,128,0)" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaD}
        fill="url(#spark-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      />
      <motion.path
        d={lineD}
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.9, ease: EASE }}
        style={{ filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.5))' }}
      />
    </svg>
  );
}

function ConversionRing({ rate, label }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (rate / 100) * c;

  return (
    <div className="pipeline-command__ring-wrap">
      <svg className="pipeline-command__ring-svg" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="pipeline-conversion-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#a3e635" />
          </linearGradient>
        </defs>
        <circle className="pipeline-command__ring-bg" cx={size / 2} cy={size / 2} r={r} />
        <motion.circle
          className="pipeline-command__ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeDasharray={`${dash} ${c}`}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c}` }}
          transition={{ delay: 0.4, duration: 0.9, ease: EASE }}
        />
      </svg>
      <div className="text-center" style={{ marginTop: '-5.5rem' }}>
        <p className="text-2xl font-extrabold text-white tabular-nums">
          <AnimatedNumber value={rate} />%
        </p>
        <p className="text-[10px] uppercase tracking-widest text-white/40 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function PipelineCommandCenter({ stats = {}, leads = [] }) {
  const navigate = useNavigate();
  const data = useMemo(() => derivePipelineDashboard(leads, stats), [leads, stats]);

  const {
    kpis,
    statusSegments,
    statusTotal,
    templateBars,
    maxTemplate,
    conversionRate,
    replyRate,
    sparkline,
    activityItems,
    recentLeads,
    hotLeads,
    sentToday,
  } = data;

  if (statusTotal === 0) {
    return (
      <div className="pipeline-command">
        <div className="pipeline-command__empty">
          <div className="pipeline-command__empty-icon">
            <TrendingUp size={22} />
          </div>
          <p className="font-semibold text-white/80">No lead data yet</p>
          <p className="text-sm mt-2">
            <Link to="/send" className="text-[#4ade80] hover:underline">
              Send your first template
            </Link>{' '}
            to see pipeline analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="pipeline-command">
      <div className="pipeline-command__glow" aria-hidden />

      <header className="pipeline-command__header">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <h2 className="pipeline-command__title">Pipeline Summary</h2>
          <p className="pipeline-command__sub">
            Pest control command center ·{' '}
            <strong>{statusTotal.toLocaleString()}</strong> leads ·{' '}
            <strong>{sentToday}</strong> sent today
          </p>
        </motion.div>
        <motion.button
          type="button"
          className="pipeline-command__cta"
          onClick={() => navigate('/leads')}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          View pipeline <ArrowUpRight size={14} />
        </motion.button>
      </header>

      <div className="pipeline-command__kpi-grid">
        {kpis.map((kpi, i) => (
          <MotionCard
            key={kpi.id}
            delay={STAGGER * i}
            onClick={kpi.href ? () => navigate(kpi.href) : undefined}
          >
            <p className="pipeline-command__card-label">{kpi.label}</p>
            <p className="pipeline-command__card-value">
              <AnimatedNumber value={kpi.value} />
            </p>
          </MotionCard>
        ))}
      </div>

      <div className="pipeline-command__main">
        <motion.div
          className="pipeline-command__panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45, ease: EASE }}
          whileHover={{ boxShadow: '0 12px 40px rgba(74,222,128,0.08)' }}
        >
          <p className="pipeline-command__panel-title">Pipeline overview</p>
          <div className="pipeline-command__overview-grid">
            <StatusDonut segments={statusSegments} total={statusTotal} />
            <div>
              <div className="pipeline-command__legend">
                {statusSegments.map(seg => (
                  <div key={seg.key} className="pipeline-command__legend-row">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="pipeline-command__legend-dot"
                        style={{ background: seg.color, boxShadow: `0 0 8px ${seg.color}66` }}
                      />
                      {seg.label}
                    </span>
                    <strong className="text-white tabular-nums">{seg.count}</strong>
                  </div>
                ))}
              </div>
              <p className="text-[10px] uppercase tracking-widest text-white/35 mt-3 mb-1">
                Templates sent (7 days)
              </p>
              <Sparkline points={sparkline.points} max={sparkline.max} />
            </div>
          </div>

          {templateBars.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/6">
              <p className="pipeline-command__panel-title mb-3">Template performance</p>
              {templateBars.map((bar, i) => (
                <div key={bar.key} className="pipeline-command__bar-row">
                  <span className="pipeline-command__bar-label">{bar.label}</span>
                  <div className="pipeline-command__bar-track">
                    <motion.div
                      className="pipeline-command__bar-fill"
                      style={{ background: `linear-gradient(90deg, ${bar.color}99, ${bar.color})` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(bar.count / maxTemplate) * 100}%` }}
                      transition={{ delay: 0.35 + i * 0.06, duration: 0.6, ease: EASE }}
                    />
                  </div>
                  <span className="pipeline-command__bar-count">{bar.count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <div className="flex flex-col gap-4">
          <motion.div
            className="pipeline-command__panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.45, ease: EASE }}
            whileHover={{ boxShadow: '0 12px 40px rgba(74,222,128,0.08)' }}
          >
            <p className="pipeline-command__panel-title">Conversion & replies</p>
            <ConversionRing rate={conversionRate} label="Sold rate" />
            <div className="flex justify-center gap-6 mt-2 text-center">
              <div>
                <p className="text-lg font-bold text-[#4ade80] tabular-nums">
                  <AnimatedNumber value={replyRate} />%
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-wide">Reply rate</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white tabular-nums">
                  <AnimatedNumber value={sentToday} />
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-wide">Sent today</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="pipeline-command__panel flex-1"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.45, ease: EASE }}
          >
            <p className="pipeline-command__panel-title flex items-center gap-2">
              <Zap size={12} className="text-[#4ade80]" />
              Live activity
            </p>
            <div className="pipeline-command__activity">
              {activityItems.length === 0 ? (
                <p className="text-xs text-white/40 py-4 text-center">No recent activity</p>
              ) : (
                activityItems.map((item, i) => {
                  const Icon = ACTIVITY_ICONS[item.type] || Users;
                  return (
                    <motion.div
                      key={item.id}
                      className="pipeline-command__activity-item"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      whileHover={{ x: 2 }}
                    >
                      <div className={`pipeline-command__activity-icon pipeline-command__activity-icon--${item.tone}`}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="pipeline-command__activity-title">{item.title}</p>
                        <p className="pipeline-command__activity-sub">{item.sub}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="pipeline-command__bottom">
        <motion.div
          className="pipeline-command__panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.4, ease: EASE }}
        >
          <p className="pipeline-command__panel-title">Needs attention</p>
          {hotLeads.length === 0 ? (
            <p className="text-xs text-white/40">No urgent leads right now</p>
          ) : (
            hotLeads.map(lead => {
              const av = getAvatarStyle(lead.name);
              return (
                <div
                  key={lead.row_number}
                  className="pipeline-command__lead-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/leads')}
                  onKeyDown={(e) => e.key === 'Enter' && navigate('/leads')}
                >
                  <div
                    className="pipeline-command__avatar"
                    style={{ background: av.bg, color: av.text }}
                  >
                    {getInitials(lead.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="pipeline-command__lead-name">{lead.name}</p>
                    <p className="pipeline-command__lead-meta">{lead._reason || lead.notes}</p>
                  </div>
                </div>
              );
            })
          )}
        </motion.div>

        <motion.div
          className="pipeline-command__panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.4, ease: EASE }}
        >
          <p className="pipeline-command__panel-title">Most recent leads</p>
          {recentLeads.length === 0 ? (
            <p className="text-xs text-white/40">No sent leads yet</p>
          ) : (
            recentLeads.map(lead => {
              const av = getAvatarStyle(lead.name);
              const tpl = (lead.notes || '').toUpperCase() || '—';
              return (
                <div
                  key={lead.row_number}
                  className="pipeline-command__lead-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/send', { state: { lead } })}
                  onKeyDown={(e) => e.key === 'Enter' && navigate('/send', { state: { lead } })}
                >
                  <div
                    className="pipeline-command__avatar"
                    style={{ background: av.bg, color: av.text }}
                  >
                    {getInitials(lead.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="pipeline-command__lead-name">{lead.name}</p>
                    <p className="pipeline-command__lead-meta">{tpl} · sent</p>
                  </div>
                </div>
              );
            })
          )}
        </motion.div>
      </div>
    </section>
  );
}
