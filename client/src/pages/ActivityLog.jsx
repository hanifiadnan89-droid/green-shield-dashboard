import { useMemo, useState } from 'react';
import LeadsAmbientBackground from './Leads/LeadsAmbientBackground.jsx';
import ActivityBoardHeader from './ActivityLog/ActivityBoardHeader.jsx';
import ActivityBoardControls from './ActivityLog/ActivityBoardControls.jsx';
import ActivityFloatingArena from './ActivityLog/ActivityFloatingArena.jsx';
import ActivityErrorDetailModal from './ActivityLog/ActivityErrorDetailModal.jsx';
import useActivityErrors from './ActivityLog/useActivityErrors.js';
import { filterErrorBoardItems } from './ActivityLog/filterErrorBoard.js';
import './ActivityLog/activity-log-command.css';

export default function ActivityLog() {
  const {
    items,
    loading,
    error,
    completingRow,
    load,
    complete,
  } = useActivityErrors();

  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = useMemo(
    () => filterErrorBoardItems(items, activeFilter),
    [items, activeFilter],
  );

  async function handleComplete(item) {
    await complete(item.rowNumber);
    setSelectedItem(null);
  }

  return (
    <div className="activity-board-page">
      <LeadsAmbientBackground />
      <div className="activity-board-page__inner">
        <ActivityBoardHeader count={filteredItems.length} loading={loading} />
        <ActivityBoardControls
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onSync={load}
          loading={loading}
        />
        <ActivityFloatingArena
          items={filteredItems}
          loading={loading}
          error={error}
          paused={!!selectedItem}
          onSelect={setSelectedItem}
          onComplete={handleComplete}
          onRetry={load}
        />
      </div>

      <ActivityErrorDetailModal
        item={selectedItem}
        completing={selectedItem && completingRow === selectedItem.rowNumber}
        onClose={() => setSelectedItem(null)}
        onComplete={handleComplete}
      />
    </div>
  );
}
