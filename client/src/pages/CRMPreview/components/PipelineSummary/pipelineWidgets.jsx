import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Send, MessageSquare, FileText, DollarSign, CheckCircle2,
  RefreshCw, ArrowUpRight, Activity, Bug, Rat, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Heart, Zap, Sheet,
} from 'lucide-react';
import AnimatedNumber from './AnimatedNumber.jsx';

export const EASE = [0.22, 1, 0.36, 1];

const KPI_ICONS = {
  users: Users,
  send: Send,
  message: MessageSquare,
  file: FileText,
  dollar: DollarSign,
  check: CheckCircle2,
};

export function Panel({ children, className = '', delay = 0, title, action }) {
  return (
    <motion.div
      className={`pc-panel ${className}`.trim()}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      whileHover={{
        y: -2,
        boxShadow: '0 16px 48px rgba(74,222,128,0.1)',
        transition: { duration: 0.25 },
      }}
    >
      {(title || action) && (
        <div className="pc-panel__head">
          {title && <p className="pc-panel__title">{title}</p>}
          {action}
        </div>
      )}
      {children}
    </motion.div>
  );
}

export function MiniSparkline({ data = [], color = '#4ade80', height = 28 }) {
  const w = 64;
  const h = height;
  const max = Math.max(...data, 1);
  const coords = data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * w,
    y: h - (v / max) * (h - 4) - 2,
  }));
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <svg width={w} height={h} className="pc-mini-spark">
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
      />
    </svg>
  );
}

function TrendBadge({ trend }) {
  if (trend === 0) {
    return (
      <span className="pc-trend pc-trend--flat">
        <Minus size={10} /> No change
      </span>
    );
  }
  const up = trend > 0;
  return (
    <span className={`pc-trend ${up ? 'pc-trend--up' : 'pc-trend--down'}`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(trend)}% vs last 7 days
    </span>
  );
}

export function CommandHeader({ total, sentToday, onRefresh, onViewPipeline, lastSync }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(id);
  }, []);

  const ago = formatAgo(lastSync);

  return (
    <header className="pc-header">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <h2 className="pc-header__title">
          <motion.span
            className="pc-header__pulse-icon"
            animate={{ scale: pulse ? [1, 1.15, 1] : 1, opacity: pulse ? [0.7, 1, 0.7] : 0.8 }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Activity size={18} />
          </motion.span>
          Pipeline Summary
        </h2>
        <p className="pc-header__sub">
          Pest control command center · Live data · Auto-updating
        </p>
      </motion.div>
      <motion.div
        className="pc-header__actions"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
      >
        <span className="pc-live">
          <motion.span
            className="pc-live__dot"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          Live
        </span>
        <span className="pc-header__sync">Last updated: {ago}</span>
        <motion.button
          type="button"
          className="pc-icon-btn"
          onClick={onRefresh}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Refresh"
        >
          <RefreshCw size={15} />
        </motion.button>
        <motion.button
          type="button"
          className="pc-cta-outline"
          onClick={onViewPipeline}
          whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(74,222,128,0.25)' }}
          whileTap={{ scale: 0.98 }}
        >
          View full pipeline <ArrowUpRight size={14} />
        </motion.button>
      </motion.div>
    </header>
  );
}

function formatAgo(date) {
  if (!date) return '—';
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function KpiRow({ kpis, onNavigate }) {
  return (
    <div className="pc-kpi-row">
      {kpis.map((kpi, i) => {
        const Icon = KPI_ICONS[kpi.icon] || Users;
        return (
          <motion.button
            key={kpi.id}
            type="button"
            className="pc-kpi"
            onClick={() => kpi.href && onNavigate(kpi.href)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06, duration: 0.4, ease: EASE }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
          >
            <div className="pc-kpi__top">
              <span className="pc-kpi__icon">
                <Icon size={14} />
              </span>
              <span className="pc-kpi__label">{kpi.label}</span>
            </div>
            <p className="pc-kpi__value">
              <AnimatedNumber value={kpi.value} />
            </p>
            <div className="pc-kpi__foot">
              <TrendBadge trend={kpi.trend} />
              <MiniSparkline data={kpi.spark} />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

const SERVICE_ICONS = { rit: Rat, tm: Bug, iq: Bug };

export function ServicesSnapshot({ services }) {
  return (
    <Panel title="Services Snapshot" delay={0.12} className="pc-services" action={<span className="pc-pill">This Month</span>}>
      <div className="pc-services__grid">
        {services.map((svc, i) => {
          const Icon = SERVICE_ICONS[svc.id] || Bug;
          const pct = Math.min(100, svc.count * 10);
          return (
            <motion.div
              key={svc.id}
              className="pc-service"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.08, ease: EASE }}
            >
              <motion.div
                className="pc-service__icon"
                animate={{
                  boxShadow: [
                    `0 0 12px ${svc.color}33`,
                    `0 0 22px ${svc.color}55`,
                    `0 0 12px ${svc.color}33`,
                  ],
                }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
              >
                <Icon size={16} style={{ color: svc.color }} />
              </motion.div>
              <p className="pc-service__name">{svc.label}</p>
              <p className="pc-service__count">
                <AnimatedNumber value={svc.count} />
              </p>
              <svg className="pc-service__ring" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke={svc.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 0.88} 88`}
                  transform="rotate(-90 18 18)"
                  initial={{ strokeDasharray: '0 88' }}
                  animate={{ strokeDasharray: `${pct * 0.88} 88` }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: EASE }}
                  style={{ filter: `drop-shadow(0 0 4px ${svc.color}66)` }}
                />
              </svg>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}

export function PipelineFlow({ stages, conversionRate }) {
  return (
    <Panel title="Pipeline Flow" delay={0.18} className="pc-flow-panel">
      <div className="pc-flow">
        <div className="pc-flow__beam" aria-hidden>
          <motion.div
            className="pc-flow__glow-line"
            animate={{ opacity: [0.4, 0.9, 0.4], scaleX: [0.95, 1, 0.95] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <motion.span
              key={i}
              className="pc-flow__particle"
              animate={{ left: ['-5%', '105%'], opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                delay: i * 0.35,
                ease: 'linear',
              }}
            />
          ))}
        </div>
        <div className="pc-flow__stages">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.key}
              className="pc-flow__stage"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07, ease: EASE }}
            >
              <p className="pc-flow__stage-count">
                <AnimatedNumber value={stage.count} />
              </p>
              <p className="pc-flow__stage-label">{stage.label}</p>
              <span className="pc-flow__stage-dot" style={{ background: stage.color, boxShadow: `0 0 10px ${stage.color}` }} />
            </motion.div>
          ))}
        </div>
      </div>
      <div className="pc-flow__footer">
        <span>Conversion Rate <strong>{conversionRate}%</strong></span>
        <div className="pc-flow__dots">
          {stages.map(s => (
            <span key={s.key} style={{ background: s.color }} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function ConversionTracker({ rate, trend }) {
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (rate / 100) * c;

  return (
    <Panel title="Conversion Tracker" delay={0.22} className="pc-conversion">
      <div className="pc-conversion__ring-wrap">
        <motion.svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          animate={{ rotate: [0, 2, 0, -2, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <defs>
            <linearGradient id="pc-conv-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#a3e635" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#pc-conv-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            initial={{ strokeDasharray: `0 ${c}` }}
            animate={{ strokeDasharray: `${dash} ${c}` }}
            transition={{ duration: 1, ease: EASE }}
            style={{ filter: 'drop-shadow(0 0 10px rgba(74,222,128,0.6))' }}
          />
        </motion.svg>
        <div className="pc-conversion__center">
          <AnimatedNumber value={rate} className="pc-conversion__pct" />
          <span>%</span>
          <p>CONVERSION RATE</p>
        </div>
      </div>
      <p className={`pc-conversion__trend ${trend < 0 ? 'is-down' : ''}`}>
        {trend < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
        {Math.abs(trend)}% vs last 30 days
      </p>
    </Panel>
  );
}

export function LeadActivityChart({ series }) {
  const { points, max, legend } = series;
  const w = 400;
  const h = 100;
  const pad = 8;

  const coords = points.map((p, i) => ({
    x: pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2),
    y: h - pad - (p.total / max) * (h - pad * 2),
    ...p,
  }));
  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const peak = coords.reduce((best, c) => (c.total > best.total ? c : best), coords[0]);

  return (
    <Panel title="Lead Activity (7 Days)" delay={0.26} className="pc-activity-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="pc-activity-chart__svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pc-act-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(74,222,128,0.35)" />
            <stop offset="100%" stopColor="rgba(74,222,128,0)" />
          </linearGradient>
        </defs>
        <motion.path
          d={`${lineD} L ${coords[coords.length - 1]?.x} ${h} L ${coords[0]?.x} ${h} Z`}
          fill="url(#pc-act-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        />
        <motion.path
          d={lineD}
          fill="none"
          stroke="#4ade80"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.5))' }}
        />
        {peak && (
          <motion.circle
            cx={peak.x}
            cy={peak.y}
            r="5"
            fill="#4ade80"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ delay: 1, duration: 2, repeat: Infinity }}
          />
        )}
      </svg>
      {peak && (
        <motion.span
          className="pc-activity-chart__tooltip"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          {peak.total}
        </motion.span>
      )}
      <div className="pc-activity-legend">
        {[
          { key: 'newLeads', label: 'New Leads', color: '#38bdf8' },
          { key: 'replies', label: 'Replies', color: '#4ade80' },
          { key: 'sentTemplates', label: 'Sent Templates', color: '#c084fc' },
          { key: 'followups', label: 'Follow-ups', color: '#a3e635' },
        ].map(item => (
          <div key={item.key} className="pc-activity-legend__item" style={{ borderColor: `${item.color}44` }}>
            <span style={{ color: item.color }}>{legend[item.key] ?? 0}</span>
            <small>{item.label}</small>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function FollowupsDue({ count, list, onNavigate }) {
  const size = 88;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(count / 20, 1);
  const dash = pct * c;

  return (
    <Panel title="Follow-ups Due" delay={0.32} className="pc-followups-due">
      <div className="pc-followups-due__top">
        <motion.svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          animate={{ scale: count > 0 ? [1, 1.03, 1] : 1 }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(248,113,113,0.15)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#f87171"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            animate={{
              strokeDasharray: [`${dash} ${c}`, `${dash * 0.9} ${c}`, `${dash} ${c}`],
              opacity: [0.85, 1, 0.85],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ filter: 'drop-shadow(0 0 8px rgba(248,113,113,0.5))' }}
          />
        </motion.svg>
        <div className="pc-followups-due__center">
          <AnimatedNumber value={count} />
          <span>DUE NOW</span>
        </div>
      </div>
      <ul className="pc-followups-due__list">
        <AnimatePresence mode="popLayout">
          {list.length === 0 ? (
            <li className="pc-followups-due__empty">All follow-ups on schedule</li>
          ) : (
            list.map((lead, i) => (
              <motion.li
                key={lead.row_number}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ x: 4 }}
                onClick={() => onNavigate('/followups')}
                role="button"
                tabIndex={0}
              >
                <span>{lead.name}</span>
                <span className="pc-overdue">Overdue {lead.overdueDays}d</span>
              </motion.li>
            ))
          )}
        </AnimatePresence>
      </ul>
    </Panel>
  );
}

export function TemplatePerformance({ templates, max }) {
  return (
    <Panel title="Templates Performance" delay={0.36}>
      {templates.length === 0 ? (
        <p className="pc-muted">No template sends yet</p>
      ) : (
        templates.slice(0, 5).map((t, i) => (
          <div key={t.key} className="pc-tpl-row">
            <span className="pc-tpl-row__label">{t.label}</span>
            <div className="pc-tpl-row__track">
              <motion.div
                className="pc-tpl-row__fill"
                style={{
                  background: i === templates.length - 1 && t.count < max * 0.3
                    ? 'linear-gradient(90deg,#f59e0b,#fb923c)'
                    : `linear-gradient(90deg, ${t.color}99, ${t.color})`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${(t.count / max) * 100}%` }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.7, ease: EASE }}
              />
            </div>
            <span className="pc-tpl-row__count">{t.count}</span>
          </div>
        ))
      )}
    </Panel>
  );
}

export function RepliesOverTime({ series, total, trend }) {
  const points = series.points;
  const max = series.max;
  const w = 200;
  const h = 48;
  const coords = points.map((p, i) => ({
    x: (i / Math.max(points.length - 1, 1)) * w,
    y: h - (p.count / max) * (h - 4),
  }));
  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaD = `${lineD} L ${w} ${h} L 0 ${h} Z`;

  return (
    <Panel title="Replies Over Time" delay={0.4}>
      <p className="pc-replies-total">
        <AnimatedNumber value={total} /> <span>Total Replies</span>
      </p>
      <p className={`pc-replies-trend ${trend >= 0 ? 'is-up' : 'is-down'}`}>
        {trend >= 0 ? '+' : ''}{trend}% vs last week
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="pc-replies-chart">
        <motion.path
          d={areaD}
          fill="rgba(74,222,128,0.2)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={lineD}
          fill="none"
          stroke="#4ade80"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: EASE }}
          style={{ filter: 'drop-shadow(0 0 6px rgba(74,222,128,0.5))' }}
        />
      </svg>
    </Panel>
  );
}

export function PipelineHealth({ score, checks, onNavigate }) {
  return (
    <Panel title="Pipeline Health" delay={0.44}>
      <div className="pc-health__ring">
        <motion.div
          className="pc-health__heartbeat"
          animate={{ scaleX: [1, 1.05, 1, 1.03, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <Heart size={28} className="text-[#4ade80]" />
        </motion.div>
        <svg viewBox="0 0 80 80" className="pc-health__svg">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(74,222,128,0.15)" strokeWidth="4" />
          <motion.circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 214} 214`}
            transform="rotate(-90 40 40)"
            animate={{ strokeDasharray: [`${(score / 100) * 214} 214`, `${(score / 100) * 200} 214`, `${(score / 100) * 214} 214`] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </svg>
      </div>
      <ul className="pc-health__checks">
        {checks.map((c, i) => (
          <motion.li
            key={c.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.06 }}
          >
            <CheckCircle2 size={14} className={c.ok ? 'text-[#4ade80]' : 'text-amber-400'} />
            {c.label}
          </motion.li>
        ))}
      </ul>
      <motion.button
        type="button"
        className="pc-health__btn"
        onClick={() => onNavigate('/leads')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        View details
      </motion.button>
    </Panel>
  );
}

const FEED_ICONS = {
  reply: MessageSquare,
  sent: Send,
  overdue: AlertTriangle,
  new: Zap,
  error: AlertTriangle,
};

const FEED_TONE = {
  reply: 'info',
  sent: 'purple',
  overdue: 'danger',
  new: 'success',
  error: 'danger',
};

export function TodaysActivityFeed({ items }) {
  return (
    <Panel title="Today's Activity Feed" delay={0.48} className="pc-feed-panel">
      <div className="pc-feed">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <p className="pc-muted">No activity yet today</p>
          ) : (
            items.map((item, i) => {
              const Icon = FEED_ICONS[item.type] || Zap;
              return (
                <motion.div
                  key={item.id}
                  className={`pc-feed__row pc-feed__row--${FEED_TONE[item.type] || 'info'}`}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: 0.5 + i * 0.05, ease: EASE }}
                  whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <span className="pc-feed__icon">
                    <Icon size={14} />
                  </span>
                  <span className="pc-feed__text">{item.text}</span>
                  <span className="pc-feed__time">{item.time}</span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

export function SystemStatusStrip() {
  const items = [
    { label: 'System Status', value: 'All systems operational', ok: true },
    { label: 'n8n Automation', value: 'Active', ok: true },
    { label: 'SMS Delivery', value: '99.8%', ok: true },
    { label: 'Email Delivery', value: '99.6%', ok: true },
    { label: 'Data Sync', value: 'Live', ok: true },
  ];

  return (
    <motion.footer
      className="pc-status-strip"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.4, ease: EASE }}
    >
      {items.map((item, i) => (
        <div key={item.label} className="pc-status-strip__item">
          <motion.span
            className="pc-status-strip__dot"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
          />
          <span className="pc-status-strip__label">{item.label}</span>
          <span className="pc-status-strip__value">{item.value}</span>
        </div>
      ))}
      <motion.a
        href="/leads"
        className="pc-status-strip__sheets"
        whileHover={{ x: 2 }}
      >
        <Sheet size={14} />
        Connected to Google Sheets
        <ArrowUpRight size={12} />
      </motion.a>
    </motion.footer>
  );
}
