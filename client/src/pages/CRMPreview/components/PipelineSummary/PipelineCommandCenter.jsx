import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { derivePipelineDashboard } from './derivePipelineDashboard.js';
import {
  CommandHeader,
  KpiRow,
  ServicesSnapshot,
  PipelineFlow,
  ConversionTracker,
  LeadActivityChart,
  FollowupsDue,
  TemplatePerformance,
  RepliesOverTime,
  PipelineHealth,
  TodaysActivityFeed,
  SystemStatusStrip,
} from './pipelineWidgets.jsx';
import './pipeline-command.css';

export default function PipelineCommandCenter({ stats = {}, leads = [], onRefresh }) {
  const navigate = useNavigate();
  const [lastSync, setLastSync] = useState(() => new Date());

  useEffect(() => {
    setLastSync(new Date());
  }, [leads]);

  const data = useMemo(() => derivePipelineDashboard(leads, stats), [leads, stats]);

  const handleRefresh = () => {
    onRefresh?.();
    setLastSync(new Date());
  };

  if (data.statusTotal === 0) {
    return (
      <section className="pipeline-command">
        <div className="pipeline-command__empty">
          <TrendingUp size={28} className="mx-auto mb-3 text-[#4ade80]" />
          <p className="font-semibold text-white/80">No lead data yet</p>
          <p className="text-sm mt-2">
            <Link to="/send">Send your first template</Link> to see pipeline analytics
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pipeline-command">
      <div className="pipeline-command__glow" aria-hidden />
      <div className="pipeline-command__grid">
        <CommandHeader
          total={data.statusTotal}
          sentToday={data.sentToday}
          lastSync={lastSync}
          onRefresh={handleRefresh}
          onViewPipeline={() => navigate('/leads')}
        />

        <div className="pc-top-row">
          <KpiRow kpis={data.kpis} onNavigate={navigate} />
          <ServicesSnapshot services={data.services} />
        </div>

        <div className="pc-mid-row">
          <PipelineFlow stages={data.pipelineFlow} conversionRate={data.conversionRate} />
          <ConversionTracker rate={data.conversionRate} trend={data.conversionTrend} />
          <LeadActivityChart series={data.leadActivity} />
        </div>

        <div className="pc-bottom-row">
          <FollowupsDue
            count={data.followupsDueCount}
            list={data.followupsDueList}
            onNavigate={navigate}
          />
          <TemplatePerformance templates={data.templatePerformance} max={data.maxTemplate} />
          <RepliesOverTime
            series={data.repliesSeries}
            total={data.repliesTotal}
            trend={data.repliesTrend}
          />
          <PipelineHealth
            score={data.healthScore}
            checks={data.healthChecks}
            onNavigate={navigate}
          />
          <TodaysActivityFeed items={data.todayActivity} />
        </div>

        <SystemStatusStrip />
      </div>
    </section>
  );
}
