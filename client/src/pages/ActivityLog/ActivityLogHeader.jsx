import { RefreshCw, Trash2 } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';

export default function ActivityLogHeader({
  total,
  errorTaskCount = 0,
  filter,
  onFilterChange,
  loading,
  onRefresh,
  clearing,
  onClear,
}) {
  return (
    <div className="px-6 py-5 bg-gs-bg border-b border-gs-border flex items-center justify-between gap-4">
      <div>
        <h1 className="text-lg font-bold text-gs-text">Activity Log</h1>
        <p className="text-gs-muted text-xs mt-0.5 font-medium">
          {errorTaskCount} open error task{errorTaskCount === 1 ? '' : 's'} · {total} log entries
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          className="input py-1.5 text-xs w-40"
          placeholder="Filter log..."
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
        />
        <button type="button" onClick={onRefresh} className="btn-ghost text-xs gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={clearing}
          className="btn-danger text-xs gap-1.5"
        >
          {clearing ? <Spinner size={13} /> : <Trash2 size={13} />} Clear
        </button>
      </div>
    </div>
  );
}
