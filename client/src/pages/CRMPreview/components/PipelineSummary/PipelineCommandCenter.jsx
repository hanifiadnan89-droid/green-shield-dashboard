import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGroup } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import AmbientBackground from './AmbientBackground.jsx';
import { derivePipelineDashboard } from './derivePipelineDashboard.js';
import { useLiveClock } from './useLiveClock.js';
import {
  CommandHeader,
  KpiRow,
  ServicesSnapshot,
  PipelineFlow,
  LeadActivityChart,
  FollowupsDue,
  TodaysActivityFeed,
  SystemStatusStrip,
} from './pipelineWidgets.jsx';
import './pipeline-command.css';

export default function PipelineCommandCenter({ stats = {}, leads = [], onRefresh }) {
  const navigate = useNavigate();
  const [lastSync, setLastSync] = useState(() => new Date());
  const now = useLiveClock(1000);

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
      <section className="pipeline-command pipeline-command--fullscreen">
        <AmbientBackground />

        <div className="pipeline-command__empty">
          <TrendingUp size={28} className="mx-auto mb-3 text-[#4ade80]" />
          <p className="font-semibold text-white/80">No lead data yet</p>
          <p className="text-sm mt-2">
            <Link to="/send">Send your first template</Link> to see your command center
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pipeline-command pipeline-command--fullscreen">
      <AmbientBackground />

      <LayoutGroup>
        <div className="pipeline-command__grid">
          <CommandHeader
            lastSync={lastSync}
            now={now}
            onRefresh={handleRefresh}
            onViewPipeline={() => navigate('/leads')}
          />

          <div className="pc-top-row">
            <KpiRow kpis={data.kpis} onNavigate={navigate} />
            <ServicesSnapshot services={data.services} />
          </div>

          <div className="pc-mid-row">
            <PipelineFlow stages={data.pipelineFlow} conversionRate={data.conversionRate} />
            <FollowupsDue
              count={data.followupsDueCount}
              list={data.followupsDueList}
              onNavigate={navigate}
            />
            <LeadActivityChart series={data.leadActivity} />
          </div>

          <div className="pc-feed-section">
            <TodaysActivityFeed items={data.todayActivity} count={data.todayActivity.length} />
          </div>

          <SystemStatusStrip />
        </div>
      </LayoutGroup>
    </section>
  );
}