import { Link } from 'react-router-dom';
import { Send, Users, Clock, ArrowRight } from 'lucide-react';

const ACTIONS = [
  {
    to:    '/send',
    icon:  Send,
    label: 'Send Template',
    desc:  'Choose a lead and send AG, NA, RIT, T/M, or IQ outreach sequence via SMS + email',
    iconBg:  '#dcfce7',
    iconColor: '#16A34A',
    hoverBorder: 'rgba(22,163,74,0.30)',
    hoverShadow: '0 12px 32px rgba(22,163,74,0.12)',
    badge: 'Primary',
    badgeBg: '#f0fdf4',
    badgeColor: '#16A34A',
  },
  {
    to:    '/leads',
    icon:  Users,
    label: 'Manage Leads',
    desc:  'View, search, filter, stop, and edit all pest control leads in your pipeline',
    iconBg:  '#dbeafe',
    iconColor: '#2563EB',
    hoverBorder: 'rgba(37,99,235,0.20)',
    hoverShadow: '0 12px 32px rgba(37,99,235,0.08)',
    badge: null,
  },
  {
    to:    '/followups',
    icon:  Clock,
    label: 'Follow-ups',
    desc:  'See which leads are waiting on a response or scheduled for follow-up action',
    iconBg:  '#fef3c7',
    iconColor: '#D97706',
    hoverBorder: 'rgba(217,119,6,0.20)',
    hoverShadow: '0 12px 32px rgba(217,119,6,0.08)',
    badge: null,
  },
];

export default function QuickActions() {
  return (
    <div className="p-card section-enter h-full flex flex-col">
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <h3 className="font-heading font-semibold text-[#0F172A] text-sm">Quick Actions</h3>
        <p className="text-[11px] text-[#94A3B8] mt-0.5">Jump straight into your next step</p>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-3 p-5">
        {ACTIONS.map(({ to, icon: Icon, label, desc, iconBg, iconColor, hoverBorder, hoverShadow, badge, badgeBg, badgeColor }) => (
          <Link
            key={to}
            to={to}
            className="action-card p-card flex flex-col justify-between p-4 cursor-pointer no-underline"
          >
            <div className="flex items-start justify-between mb-3">
              <div style={{ background: iconBg, borderRadius: '10px', padding: '9px', display: 'inline-flex' }}>
                <Icon size={17} style={{ color: iconColor }} />
              </div>
              {badge && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: badgeBg, color: badgeColor }}
                >
                  {badge}
                </span>
              )}
            </div>

            <div className="flex-1">
              <p className="font-heading font-semibold text-[#0F172A] text-sm mb-1 leading-tight">{label}</p>
              <p className="text-[11px] text-[#64748B] leading-relaxed">{desc}</p>
            </div>

            <div className="flex items-center justify-end mt-3">
              <ArrowRight size={13} style={{ color: iconColor, opacity: 0.7 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
