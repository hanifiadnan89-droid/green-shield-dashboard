import PipelineCommandCenter from './PipelineSummary/PipelineCommandCenter.jsx';

export default function PipelineSummary({
  stats = {},
  leads = [],
  pipelineMetrics = null,
  onRefresh,
}) {
  return (
    <PipelineCommandCenter
      stats={stats}
      leads={leads}
      pipelineMetrics={pipelineMetrics}
      onRefresh={onRefresh}
    />
  );
}
