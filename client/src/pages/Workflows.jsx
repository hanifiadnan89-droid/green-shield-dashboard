import WorkflowsHeader from './Workflows/WorkflowsHeader.jsx';
import WorkflowsHelpCard from './Workflows/WorkflowsHelpCard.jsx';
import WorkflowsView from './Workflows/WorkflowsView.jsx';
import useWorkflows from './Workflows/useWorkflows.js';

export default function Workflows() {
  const { workflows, loading, load } = useWorkflows();

  return (
    <div className="flex-1 overflow-y-auto">
      <WorkflowsHeader loading={loading} onRefresh={load} />
      <div className="px-6 py-5 animate-fade-in-up">
        <WorkflowsView workflows={workflows} loading={loading} />
        <WorkflowsHelpCard />
      </div>
    </div>
  );
}
