import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { useLiveActivityFeed } from './useLiveActivityFeed.js';
import { formatSyncAgo } from './useLiveClock.js';
import {
  Users, Send, MessageSquare, FileText, DollarSign,
  RefreshCw, ArrowUpRight, Activity, Bug, Rat, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Zap, Sheet, CheckCircle2,
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

export function Panel({ children, className = '', delay = 0, title, action, floatOffset = 0 }) {
  return (
    <motion.div
      className={`pc-panel pc-panel--glass ${className}`.trim()}
      initial={{ opacity: 0, y: 22, scale: 0.98 }}
      animate={{
        opacity: 1,
        y: [0, -3, 0],
        scale: 1,
      }}
      transition={{
        opacity: { delay, duration: 0.5, ease: EASE },
        y: { delay: delay + 0.5, duration: 5 + floatOffset, repeat: Infinity, ease: 'easeInOut' },
        scale: { delay, duration: 0.5, ease: EASE },
      }}
      whileHover={{
        y: -6,
        scale: 1.01,
        boxShadow: '0 20px 56px rgba(74,222,128,0.16), 0 0 0 1px rgba(74,222,128,0.2)',
        transition: { duration: 0.28 },
      }}
    >
      <span className="pc-panel__shimmer" aria-hidden />
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
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCycle(c => c + 1), 4200);
    return () => clearInterval(id);
  }, []);

  const coords = data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * w,
    y: h - (v / max) * (h - 4) - 2,
  }));

  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <svg width={w} height={h} className="pc-mini-spark">
      <motion.path
        key={cycle}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0.3 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
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

export function CommandHeader({ onRefresh, onViewPipeline, lastSync, now }) {
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
            animate={{ scale: [1, 1.18, 1], opacity: [0.65, 1, 0.65] }}
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

        <motion.span
          className="pc-header__sync"
          key={formatSyncAgo(lastSync, now)}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
        >
          Last updated: {formatSyncAgo(lastSync, now)}
        </motion.span>

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
            whileHover={{
              y: -6,
              boxShadow: '0 12px 40px rgba(74,222,128,0.2), inset 0 0 24px rgba(74,222,128,0.06)',
              transition: { duration: 0.22 },
            }}
          >
            <motion.span
              className="pc-kpi__glow"
              aria-hidden
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
            />

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
    <Panel
      title="Services Snapshot"
      delay={0.12}
      className="pc-services"
      action={<span className="pc-pill">This Month</span>}
    >
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

          {Array.from({ length: 14 }, (_, i) => (
            <motion.span
              key={i}
              className={`pc-flow__particle${i % 3 === 0 ? ' pc-flow__particle--lg' : ''}`}
              animate={{ left: ['-8%', '108%'], opacity: [0, 0.9, 0.9, 0] }}
              transition={{
                duration: 2.2 + (i % 4) * 0.4,
                repeat: Infinity,
                delay: i * 0.22,
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
              <motion.span
                className="pc-flow__stage-dot"
                style={{ background: stage.color, boxShadow: `0 0 10px ${stage.color}` }}
                animate={{ scale: [1, 1.25, 1], opacity: [0.85, 1, 0.85] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
              />
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
  const [scanIdx, setScanIdx] = useState(0);

  useEffect(() => {
    if (!coords.length) return undefined;

    const id = setInterval(() => {
      setScanIdx(i => (i + 1) % coords.length);
    }, 800);

    return () => clearInterval(id);
  }, [coords.length]);

  const scanX = coords[scanIdx]?.x ?? 0;

  return (
    <Panel title="Lead Activity (7 Days)" delay={0.26} className="pc-activity-chart" floatOffset={0.5}>
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
          animate={{ pathLength: [0, 1, 1], pathOffset: [0, 0, 0.02] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
          style={{ filter: 'drop-shadow(0 0 10px rgba(74,222,128,0.55))' }}
        />

        <motion.line
          x1={scanX}
          x2={scanX}
          y1={pad}
          y2={h - pad}
          stroke="rgba(74,222,128,0.35)"
          strokeWidth="1"
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
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
    <Panel title="Follow-ups Due" delay={0.22} className="pc-followups-due pc-followups-due--mid">
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

export function TodaysActivityFeed({ items, count = 0 }) {
  const { visible, pulseId } = useLiveActivityFeed(items, 3200);

  return (
    <Panel
      title="Today's Activity Feed"
      delay={0.32}
      className="pc-feed-panel pc-feed-panel--hero"
      floatOffset={0.6}
      action={
        <motion.span
          className="pc-feed-live-pill"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="pc-live__dot" />
          Live
        </motion.span>
      }
    >
      <p className="pc-feed-hero__sub">
        Real-time pipeline events · <strong>{count}</strong> recent {count === 1 ? 'update' : 'updates'}
      </p>
      <div className="pc-feed pc-feed--timeline">
        <div className="pc-feed__rail" aria-hidden />
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {visible.length === 0 ? (
              <p className="pc-muted pc-feed__empty">No activity yet today</p>
            ) : (
              visible.map((item) => {
                const Icon = FEED_ICONS[item.type] || Zap;
                const isPulse = item.id === pulseId;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    className={`pc-feed__row pc-feed__row--${FEED_TONE[item.type] || 'info'}${isPulse ? ' pc-feed__row--pulse' : ''}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    whileHover={{ x: 8, backgroundColor: 'rgba(74,222,128,0.1)' }}
                  >
                    <span className="pc-feed__node" />
                    <span className="pc-feed__icon">
                      <Icon size={16} />
                    </span>
                    <div className="pc-feed__body">
                      <span className="pc-feed__text">{item.text}</span>
                      <span className="pc-feed__time">{item.time}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </LayoutGroup>
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

      <motion.div whileHover={{ x: 2 }}>
        <Link to="/leads" className="pc-status-strip__sheets">
          <Sheet size={14} />
          Connected to Google Sheets
          <ArrowUpRight size={12} />
        </Link>
      </motion.div>
    </motion.footer>
  );
}