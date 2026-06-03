import PipelineCommandCenter from './PipelineSummary/PipelineCommandCenter.jsx';

export default function PipelineSummary({ stats = {}, leads = [], onRefresh }) {
  return <PipelineCommandCenter stats={stats} leads={leads} onRefresh={onRefresh} />;
}
