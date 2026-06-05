import { Activity } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { filterActivityLog } from './filterActivityLog.js';
import ActivityLogEntry from './ActivityLogEntry.jsx';
import ActivityErrorTasksSection from './ActivityErrorTasksSection.jsx';

export default function ActivityLogView({
  log,
  filter,
  loading,
  errorTasks,
  errorsLoading,
  errorsError,
  completingRow,
  onRefreshErrors,
  onCompleteError,
}) {
  const filtered = filterActivityLog(log, filter);

  return (
    <div className="px-6 py-4 animate-fade-in-up">
      <ActivityErrorTasksSection
        items={errorTasks}
        loading={errorsLoading}
        error={errorsError}
        completingRow={completingRow}
        onRefresh={onRefreshErrors}
        onComplete={onCompleteError}
      />

      <div className="border-t border-gs-border/70 pt-5">
        <h2 className="text-sm font-bold text-gs-text mb-3">Recent Activity</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            desc="Actions you take in the dashboard will appear here"
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => (
              <ActivityLogEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
