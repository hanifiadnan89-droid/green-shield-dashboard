import ActivityLogHeader from './ActivityLog/ActivityLogHeader.jsx';
import ActivityLogView from './ActivityLog/ActivityLogView.jsx';
import useActivityLog from './ActivityLog/useActivityLog.js';
import useActivityErrors from './ActivityLog/useActivityErrors.js';

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

  const {
    items: errorTasks,
    loading: errorsLoading,
    error: errorsError,
    completingRow,
    load: loadErrors,
    complete: completeError,
  } = useActivityErrors();

  function handleRefreshAll() {
    load();
    loadErrors();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <ActivityLogHeader
        total={total}
        errorTaskCount={errorTasks.length}
        filter={filter}
        onFilterChange={setFilter}
        loading={loading || errorsLoading}
        onRefresh={handleRefreshAll}
        clearing={clearing}
        onClear={handleClear}
      />
      <ActivityLogView
        log={log}
        filter={filter}
        loading={loading}
        errorTasks={errorTasks}
        errorsLoading={errorsLoading}
        errorsError={errorsError}
        completingRow={completingRow}
        onRefreshErrors={loadErrors}
        onCompleteError={completeError}
      />
    </div>
  );
}
