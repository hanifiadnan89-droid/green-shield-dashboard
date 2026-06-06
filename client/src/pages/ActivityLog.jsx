import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LeadsAmbientBackground from './Leads/LeadsAmbientBackground.jsx';
import ActivityBoardHeader from './ActivityLog/ActivityBoardHeader.jsx';
import ActivityBoardControls from './ActivityLog/ActivityBoardControls.jsx';
import ActivityCashMetric from './ActivityLog/ActivityCashMetric.jsx';
import ActivityFloatingArena from './ActivityLog/ActivityFloatingArena.jsx';
import ActivityErrorDetailModal from './ActivityLog/ActivityErrorDetailModal.jsx';
import RecoveryValueFlight from './ActivityLog/RecoveryValueFlight.jsx';
import useActivityErrors from './ActivityLog/useActivityErrors.js';
import { filterErrorBoardItems } from './ActivityLog/filterErrorBoard.js';
import { computeLostContractMetrics } from './ActivityLog/computeBoardMetrics.js';
import useCountingValue from './ActivityLog/useCountingValue.js';
import useReducedMotion from './ActivityLog/useReducedMotion.js';
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

  const reducedMotion = useReducedMotion();
  const metricAmountRef = useRef(null);
  const recoveringRef = useRef(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [recoveryFlight, setRecoveryFlight] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveringIds, setRecoveringIds] = useState(() => new Set());

  const boardItems = useMemo(
    () => filterErrorBoardItems(items, 'all'),
    [items],
  );

  const filteredItems = useMemo(
    () => filterErrorBoardItems(items, activeFilter),
    [items, activeFilter],
  );

  const visibleItems = useMemo(
    () => filteredItems.filter(item => !recoveringIds.has(item.id)),
    [filteredItems, recoveringIds],
  );

  const metrics = useMemo(
    () => computeLostContractMetrics(boardItems),
    [boardItems],
  );

  const { displayValue, animateTo, setImmediate, getValue } = useCountingValue(metrics.totalLost);

  useEffect(() => {
    if (!recoveringRef.current) {
      setImmediate(metrics.totalLost);
    }
  }, [metrics.totalLost, setImmediate]);

  const finishRecovery = useCallback(async (item, amount) => {
    const nextLost = Math.max(0, getValue() - (amount || 0));
    recoveringRef.current = true;
    setIsRecovering(true);

    animateTo(nextLost, {
      duration: reducedMotion ? 200 : 720,
      onComplete: async () => {
        if (item?.rowNumber) {
          await complete(item.rowNumber);
        }
        setSelectedItem(null);
        setRecoveringIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        recoveringRef.current = false;
        setIsRecovering(false);
      },
    });
  }, [animateTo, complete, getValue, reducedMotion]);

  const beginRecovery = useCallback(({ item, amount, label, fromRect }) => {
    if (!Number.isFinite(amount) || amount <= 0 || !fromRect) {
      finishRecovery(item, amount || 0);
      return;
    }

    setRecoveringIds((prev) => new Set(prev).add(item.id));

    setRecoveryFlight({
      id: item.id,
      item,
      amount,
      label,
      fromRect,
    });
  }, [finishRecovery]);

  const handleFlightComplete = useCallback(() => {
    if (!recoveryFlight) return;
    const { item, amount } = recoveryFlight;
    setRecoveryFlight(null);
    finishRecovery(item, amount);
  }, [recoveryFlight, finishRecovery]);

  async function handleModalComplete(item) {
    const amount = Number.isFinite(item.contractValue) ? item.contractValue : 0;
    setSelectedItem(null);
    await finishRecovery(item, amount);
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
        <ActivityCashMetric
          ref={metricAmountRef}
          displayLostValue={displayValue}
          activeCount={metrics.activeCount}
          loading={loading}
          isRecovering={isRecovering}
          allResolved={metrics.allResolved && !loading && !error}
        />
        <ActivityFloatingArena
          items={visibleItems}
          loading={loading}
          error={error}
          paused={!!selectedItem || !!recoveryFlight}
          allResolved={metrics.allResolved && !loading && !error}
          onSelect={setSelectedItem}
          onRecover={beginRecovery}
          onRetry={load}
        />
      </div>

      <RecoveryValueFlight
        flight={recoveryFlight}
        targetRef={metricAmountRef}
        reducedMotion={reducedMotion}
        onComplete={handleFlightComplete}
      />

      <ActivityErrorDetailModal
        item={selectedItem}
        completing={selectedItem && completingRow === selectedItem.rowNumber}
        onClose={() => setSelectedItem(null)}
        onComplete={handleModalComplete}
      />
    </div>
  );
}
