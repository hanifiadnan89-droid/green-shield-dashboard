import PipelineCommandCenter from './PipelineSummary/PipelineCommandCenter.jsx';

export default function PipelineSummary({ stats = {}, leads = [] }) {
  return <PipelineCommandCenter stats={stats} leads={leads} />;
}
