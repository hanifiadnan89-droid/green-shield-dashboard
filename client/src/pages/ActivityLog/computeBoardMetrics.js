export function computeLostContractMetrics(items = []) {
  const activeItems = items.filter(item => !item.isComplete);
  const countable = activeItems.filter(item => Number.isFinite(item.contractValue));
  const totalLost = countable.reduce((sum, item) => sum + item.contractValue, 0);

  return {
    totalLost,
    lostLabel: formatLostValue(totalLost),
    activeCount: activeItems.length,
    countableCount: countable.length,
    allResolved: activeItems.length === 0,
    subtext: activeItems.length === 0
      ? 'No revenue at risk'
      : activeItems.length === 1
        ? '1 unresolved error · contract value at risk'
        : `${activeItems.length} unresolved errors · contract value at risk`,
  };
}

export function formatLostValue(value) {
  const amount = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (amount === 0) return '$0 USD';
  return `-$${amount.toLocaleString('en-US')} USD`;
}

/** @deprecated Use computeLostContractMetrics */
export function computeUnpaidInitialMetrics(items = []) {
  const unpaidItems = items.filter(item => item.category === 'unpaid');
  return computeLostContractMetrics(unpaidItems);
}
