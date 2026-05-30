import { AlertTriangle, MessageSquare, FileCheck, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deriveSalesStats } from '../mockData.js';
import AnimatedNumber from '../../../components/AnimatedNumber.jsx';

const CARDS = [
  {
    key: 'needsAction',
    label: 'Needs Action',
    sub: 'Replies + errors awaiting',
    icon: AlertTriangle,
    iconColor: '#DC2626',
    iconBg: 'rgba(220,38,38,0.10)',
    activeBorder: 'rgba(220,38,38,0.18)',
    href: '/leads',
  },
  {
    key: 'hotReplies',
    label: 'Hot Replies',
    sub: 'Customers responded',
    icon: MessageSquare,
    iconColor: '#16A34A',
    iconBg: 'rgba(22,163,74,0.10)',
    activeBorder: 'rgba(22,163,74,0.18)',
    href: '/leads',
  },
  {
    key: 'agreementsPending',
    label: 'Agreements Pending',
    sub: 'AG leads awaiting reply',
    icon: FileCheck,
    iconColor: '#2563EB',
    iconBg: 'rgba(37,99,235,0.10)',
    activeBorder: 'rgba(37,99,235,0.18)',
    href: '/leads?notes=ag',
  },
  {
    key: 'followUpQueue',
    label: 'Follow-up Queue',
    sub: 'Active leads in sequence',
    icon: Clock,
    iconColor: '#D97706',
    iconBg: 'rgba(217,119,6,0.10)',
    activeBorder: 'rgba(217,119,6,0.18)',
    href: '/leads',
  },
];

export default function SalesSummaryBar({ leads = [], loading = false }) {
  const navigate = useNavigate();
  const stats = loading ? null : deriveSalesStats(leads);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map(({ key, label, sub, icon: Icon, iconColor, iconBg, activeBorder, href }, i) => {
        const count = stats ? (stats[key] ?? 0) : 0;
        const hasActivity = count > 0;

        return (
          <div
            key={key}
            className="bento-card card-kpi p-card-lift flex items-center gap-4 p-5 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => navigate(href)}
            onKeyDown={e => e.key === 'Enter' && navigate(href)}
            style={{
              animationDelay: `${i * 65}ms`,
              borderColor: hasActivity ? activeBorder : undefined,
            }}
          >
            {/* Icon container */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={16} style={{ color: iconColor }} />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              {loading ? (
                <>
                  <div className="skeleton mb-1.5 rounded" style={{ height: '30px', width: '40px' }} />
                  <div className="skeleton h-2.5 w-20 rounded" />
                </>
              ) : (
                <>
                  <p
                    className="font-display font-bold text-gs-text leading-none mb-1"
                    style={{ fontSize: '30px' }}
                  >
                    <AnimatedNumber value={count} />
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gs-muted leading-tight">
                    {label}
                  </p>
                  <p className="text-[10px] text-gs-muted/60 mt-0.5 leading-tight">{sub}</p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
