import { useMemo, useState } from 'react';
import LeadsAmbientBackground from './Leads/LeadsAmbientBackground.jsx';
import ActivityBoardHeader from './ActivityLog/ActivityBoardHeader.jsx';
import ActivityBoardControls from './ActivityLog/ActivityBoardControls.jsx';
import ActivityCashMetric from './ActivityLog/ActivityCashMetric.jsx';
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

  const unpaidItems = useMemo(
    () => items.filter(item => item.category === 'unpaid'),
    [items],
  );

  async function handleComplete(item) {
    await complete(item.rowNumber);
    setSelectedItem(null);
  }

  return (
    <div className="activity-board-page">
      <LeadsAmbientBackground />
      <div className="activity-board-page__inner">
        <div className="activity-board-top">
          <ActivityBoardHeader />
          <ActivityBoardControls
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onSync={load}
            loading={loading}
          />
        </div>
        <ActivityCashMetric items={unpaidItems} loading={loading} />
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
