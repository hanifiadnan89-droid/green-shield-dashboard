import Spinner from '../../components/Spinner.jsx';
import WorkflowCard from './WorkflowCard.jsx';

export default function WorkflowsView({ workflows, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {workflows.map(wf => (
        <WorkflowCard key={wf.id} workflow={wf} />
      ))}
    </div>
  );
}
