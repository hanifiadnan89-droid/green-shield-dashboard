import { RefreshCw } from 'lucide-react';

export default function WorkflowsHeader({ loading, onRefresh }) {
  return (
    <div className="px-6 py-5 bg-gs-bg border-b border-gs-border flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold text-gs-text">Workflows</h1>
        <p className="text-gs-muted text-xs mt-0.5">Your active n8n automation workflows</p>
      </div>
      <button type="button" onClick={onRefresh} className="btn-ghost text-xs gap-1.5">
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
  );
}
