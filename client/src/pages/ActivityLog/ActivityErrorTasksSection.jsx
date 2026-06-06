import { AlertCircle, RefreshCw } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ActivityErrorTask from './ActivityErrorTask.jsx';

export default function ActivityErrorTasksSection({
  items,
  loading,
  error,
  completingRow,
  onRefresh,
  onComplete,
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold text-gs-text">Open Error Tasks</h2>
          <p className="text-gs-muted text-xs mt-0.5">
            Action/Error Lists · assigned to AH
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="btn-ghost text-xs gap-1.5"
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Sync
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error && items.length === 0 ? (
        <div className="rounded-xl border border-gs-danger/25 bg-gs-danger/8 p-4">
          <p className="text-gs-danger text-sm font-semibold">Could not load error tasks</p>
          <p className="text-gs-muted text-xs mt-1 leading-relaxed whitespace-pre-wrap">{error}</p>
          <button type="button" onClick={onRefresh} className="btn-ghost text-xs mt-3">
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No open errors assigned to AH."
          desc="Unresolved items from Action/Error Lists will appear here."
        />
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <ActivityErrorTask
              key={item.id}
              item={item}
              completing={completingRow}
              onComplete={onComplete}
            />
          ))}
        </div>
      )}

      {error && items.length > 0 && (
        <p className="text-gs-warn text-xs mt-2">
          Last sync issue: {error}
        </p>
      )}
    </section>
  );
}
