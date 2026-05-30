import { Activity, Mail, MessageSquare, Send, StopCircle, PlayCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { timeAgo, getActivityMeta } from '../mockData.js';
import EmptyState from '../../../components/EmptyState.jsx';

const ICON_MAP = {
  'sms':    MessageSquare,
  'email':  Mail,
  'error':  AlertCircle,
  'fail':   AlertCircle,
  'stop':   StopCircle,
  'unstop': PlayCircle,
  'resume': PlayCircle,
  'send':   Send,
  'sent':   Send,
};

function resolveIcon(action = '') {
  const a = action.toLowerCase();
  for (const [key, Icon] of Object.entries(ICON_MAP)) {
    if (a.includes(key)) return Icon;
  }
  return Activity;
}

export default function ActivityFeed({ activity = [] }) {
  return (
    <div className="p-card section-enter flex flex-col" style={{ minHeight: '400px' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div>
          <h3 className="font-display font-semibold text-[#0F172A] text-sm">Activity Feed</h3>
          <p className="type-label-md text-[#94A3B8] mt-0.5">Recent CRM events</p>
        </div>
        <Link
          to="/activity"
          className="flex items-center gap-1 text-xs font-medium text-[#16A34A] hover:text-[#15803d] transition-colors cursor-pointer"
        >
          View all <ArrowRight size={11} />
        </Link>
      </div>

      {activity.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" desc="Events appear here as you send templates" />
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {activity.slice(0, 50).map((entry, idx) => {
            const meta = getActivityMeta(entry.action || '');
            const Icon = resolveIcon(entry.action || '');
            const isLast = idx === activity.length - 1;
            const isError = entry.status === 'error' || (entry.action || '').toLowerCase().includes('error') || (entry.action || '').toLowerCase().includes('fail');

            return (
              <div key={entry.id || idx} className="feed-item flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    style={{
                      background: meta.bg,
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={13} style={{ color: meta.color }} />
                  </div>
                  {!isLast && (
                    <div style={{ width: '1px', background: 'rgba(0,0,0,0.07)', flex: 1, marginTop: '4px', minHeight: '16px' }} />
                  )}
                </div>

                <div className={`flex-1 ${isLast ? 'pb-2' : 'pb-4'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] leading-tight">
                        {meta.label}
                        {entry.testMode && (
                          <span className="ml-1.5 type-label-sm text-[#D97706] bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-full">TEST</span>
                        )}
                      </p>
                      <p className="type-label-md text-[#94A3B8] mt-0.5 truncate">
                        {entry.leadName || '—'}
                        {entry.template && (
                          <span className="ml-1 uppercase font-semibold" style={{ color: meta.color }}>· {entry.template}</span>
                        )}
                      </p>
                    </div>
                    <p className="type-label-sm text-[#94A3B8] shrink-0 mt-0.5">
                      {entry.timestamp ? timeAgo(entry.timestamp) : '—'}
                    </p>
                  </div>
                  {isError && entry.error && (
                    <p className="text-[10px] text-[#DC2626] mt-1 truncate">{entry.error}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
