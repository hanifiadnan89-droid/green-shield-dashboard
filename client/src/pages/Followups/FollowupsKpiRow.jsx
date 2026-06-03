import { motion } from 'motion/react';
import { Clock, AlertTriangle, StopCircle, MessageSquare, Calendar } from 'lucide-react';

const CARDS = [
  { key: 'active', label: 'Active Follow-ups', icon: Clock, tone: '' },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle, tone: 'warn' },
  { key: 'stopped', label: 'Stopped', icon: StopCircle, tone: '' },
  { key: 'replied', label: 'Replies Received', icon: MessageSquare, tone: '' },
  { key: 'avgDays', label: 'Avg Days Since Sent', icon: Calendar, tone: '', suffix: 'd' },
];

export default function FollowupsKpiRow({ kpis, loading }) {
  return (
    <div className="followups-kpi-grid">
      {CARDS.map((card, i) => {
        const Icon = card.icon;
        const raw = kpis[card.key];
        const value = loading ? '—' : card.key === 'avgDays' ? raw : raw;
        const display = loading ? '—' : card.suffix ? `${value}${card.suffix}` : value;

        return (
          <motion.div
            key={card.key}
            className={`followups-kpi${card.tone === 'warn' && !loading && raw > 0 ? ' followups-kpi--warn' : ''}${card.key === 'overdue' && !loading && raw > 0 ? ' followups-kpi--danger' : ''}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className="text-gs-muted" />
              <p className="followups-kpi__label">{card.label}</p>
            </div>
            <p className="followups-kpi__value">{display}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
