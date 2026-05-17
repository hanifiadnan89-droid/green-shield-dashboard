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
    iconBg: '#fef2f2',
    iconColor: '#DC2626',
    accent: '#DC2626',
    href: '/leads',
  },
  {
    key: 'hotReplies',
    label: 'Hot Replies',
    sub: 'Customers responded',
    icon: MessageSquare,
    iconBg: '#f0fdf4',
    iconColor: '#16A34A',
    accent: '#16A34A',
    href: '/leads',
  },
  {
    key: 'agreementsPending',
    label: 'Agreements Pending',
    sub: 'AG leads awaiting reply',
    icon: FileCheck,
    iconBg: '#eff6ff',
    iconColor: '#2563EB',
    accent: '#2563EB',
    href: '/leads?notes=ag',
  },
  {
    key: 'followUpQueue',
    label: 'Follow-up Queue',
    sub: 'Active leads in sequence',
    icon: Clock,
    iconBg: '#fffbeb',
    iconColor: '#D97706',
    accent: '#D97706',
    href: '/leads',
  },
];

export default function SalesSummaryBar({ leads = [], loading = false }) {
  const navigate = useNavigate();
  const stats = loading ? null : deriveSalesStats(leads);

  return (
    <div className="grid grid-cols-4 gap-4">
      {CARDS.map(({ key, label, sub, icon: Icon, iconBg, iconColor, accent, href }, i) => {
        const count = stats ? (stats[key] ?? 0) : 0;
        const hasActivity = count > 0;

        return (
          <div
            key={key}
            className="bento-card p-card stat-card-float flex items-center gap-4 p-5"
            role="button"
            tabIndex={0}
            onClick={() => navigate(href)}
            onKeyDown={e => e.key === 'Enter' && navigate(href)}
            style={{
              borderBottom: hasActivity ? `3px solid ${accent}` : '3px solid transparent',
              animationDelay: `${i * 65}ms`,
            }}
          >
            <div
              style={{
                background: iconBg,
                borderRadius: '12px',
                padding: '10px',
                display: 'inline-flex',
                flexShrink: 0,
              }}
            >
              <Icon size={18} style={{ color: iconColor }} />
            </div>

            <div className="min-w-0 flex-1">
              {loading ? (
                <>
                  <div className="skeleton mb-1.5 rounded" style={{ height: '28px', width: '40px' }} />
                  <div className="skeleton h-2.5 w-20 rounded" />
                </>
              ) : (
                <>
                  <p
                    className="font-heading font-bold text-[#0F172A] leading-none mb-1"
                    style={{ fontSize: '28px' }}
                  >
                    <AnimatedNumber value={count} />
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8] leading-tight">
                    {label}
                  </p>
                  <p className="text-[10px] text-[#B4BFCC] mt-0.5 leading-tight">{sub}</p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
