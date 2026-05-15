import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import PipelineSummaryChart from './PipelineSummaryChart.jsx';

export default function PipelineSummary({ byTemplate = {}, total = 0 }) {
  const templateTotal = Object.values(byTemplate).reduce((a, b) => a + b, 0);
  const isEmpty = templateTotal === 0;

  return (
    <div className="p-card section-enter h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <div>
          <h3 className="font-heading font-semibold text-[#0F172A] text-sm">Pipeline Summary</h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            Template distribution · {total} total leads
          </p>
        </div>
        <Link
          to="/leads"
          className="flex items-center gap-1 text-xs font-medium text-[#16A34A] hover:text-[#15803d] transition-colors cursor-pointer"
        >
          View <ArrowRight size={11} />
        </Link>
      </div>

      {/* Content */}
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
        <div className="flex-1 overflow-hidden">
          <PipelineSummaryChart byTemplate={byTemplate} total={total} />
        </div>
      )}
    </div>
  );
}
