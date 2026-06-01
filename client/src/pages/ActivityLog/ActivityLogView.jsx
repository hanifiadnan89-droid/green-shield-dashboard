import { Activity } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { filterActivityLog } from './filterActivityLog.js';
import ActivityLogEntry from './ActivityLogEntry.jsx';

export default function ActivityLogView({ log, filter, loading }) {
  const filtered = filterActivityLog(log, filter);

  return (
    <div className="px-6 py-4 animate-fade-in-up">
      {loading ? (
        <div className="flex justify-center py-16">
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
  );
}
