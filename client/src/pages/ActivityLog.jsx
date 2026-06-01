import ActivityLogHeader from './ActivityLog/ActivityLogHeader.jsx';
import ActivityLogView from './ActivityLog/ActivityLogView.jsx';
import useActivityLog from './ActivityLog/useActivityLog.js';

export default function ActivityLog() {
  const {
    log,
    total,
    loading,
    clearing,
    filter,
    setFilter,
    load,
    handleClear,
  } = useActivityLog();

  return (
    <div className="flex-1 overflow-y-auto">
      <ActivityLogHeader
        total={total}
        filter={filter}
        onFilterChange={setFilter}
        loading={loading}
        onRefresh={load}
        clearing={clearing}
        onClear={handleClear}
      />
      <ActivityLogView log={log} filter={filter} loading={loading} />
    </div>
  );
}
