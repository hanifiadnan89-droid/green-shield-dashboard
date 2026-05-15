import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { TEMPLATE_META } from '../mockData.js';

const ROWS = [
  { key: 'ag',  dataKey: 'ag',  ...TEMPLATE_META.ag  },
  { key: 'na',  dataKey: 'na',  ...TEMPLATE_META.na  },
  { key: 'rit', dataKey: 'rit', ...TEMPLATE_META.rit },
  { key: 'tm',  dataKey: 'tm',  ...TEMPLATE_META.tm  },
  { key: 'iq',  dataKey: 'iq',  ...TEMPLATE_META.iq  },
];

export default function PipelineSummary({ byTemplate = {}, total = 0 }) {
  const templateTotal = Object.values(byTemplate).reduce((a, b) => a + b, 0);
  const isEmpty = templateTotal === 0;

  return (
    <div className="p-card section-enter h-full flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div>
          <h3 className="font-heading font-semibold text-[#0F172A] text-sm">Pipeline Summary</h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Template distribution · {total} total leads</p>
        </div>
        <Link
          to="/leads"
          className="flex items-center gap-1 text-xs font-medium text-[#16A34A] hover:text-[#15803d] transition-colors cursor-pointer"
        >
          View <ArrowRight size={11} />
        </Link>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 text-center">
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px', display: 'inline-flex', marginBottom: '12px' }}>
            <TrendingUp size={20} style={{ color: '#94A3B8' }} />
          </div>
          <p className="text-sm font-medium text-[#64748B]">No templates sent yet</p>
          <p className="text-xs text-[#94A3B8] mt-1">
            <Link to="/send" className="text-[#16A34A] hover:underline">Send your first template</Link> to see the breakdown
          </p>
        </div>
      ) : (
        <div className="flex-1 px-5 py-4 space-y-3.5">
          {ROWS.map(({ key, dataKey, label, fullLabel, color, bg, textColor }) => {
            const count = byTemplate[dataKey] ?? 0;
            const pct = templateTotal > 0 ? Math.round((count / templateTotal) * 100) : 0;

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
                    />
                    <span className="text-xs font-semibold text-[#0F172A]">{label}</span>
                    <span className="text-[11px] text-[#94A3B8]">{fullLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: bg, color: textColor }}
                    >
                      {count}
                    </span>
                    <span className="text-[11px] text-[#94A3B8] tabular-nums w-7 text-right">{pct}%</span>
                  </div>
                </div>
                <div
                  style={{
                    height: '5px',
                    background: 'rgba(0,0,0,0.06)',
                    borderRadius: '999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="progress-fill h-full rounded-full"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
