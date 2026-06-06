import { RefreshCw } from 'lucide-react';
import { BOARD_FILTERS } from './filterErrorBoard.js';

export default function ActivityBoardControls({
  activeFilter,
  onFilterChange,
  onSync,
  loading,
}) {
  return (
    <div className="activity-board-controls">
      {BOARD_FILTERS.map(filter => (
        <button
          key={filter.id}
          type="button"
          className={`activity-board-filter ${activeFilter === filter.id ? 'activity-board-filter--active' : ''}`}
          onClick={() => onFilterChange(filter.id)}
        >
          {filter.label}
        </button>
      ))}
      <button
        type="button"
        className="activity-board-sync"
        onClick={onSync}
        disabled={loading}
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        Sync
      </button>
    </div>
  );
}
