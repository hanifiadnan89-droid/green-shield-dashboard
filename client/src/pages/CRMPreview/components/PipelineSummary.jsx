import PipelineSummaryFlow from './PipelineSummary/PipelineSummaryFlow.jsx';

export default function PipelineSummary({ stats = {} }) {
  return <PipelineSummaryFlow stats={stats} />;
}
