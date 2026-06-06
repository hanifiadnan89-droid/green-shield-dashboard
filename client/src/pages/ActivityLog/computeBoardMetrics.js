export function computeUnpaidInitialMetrics(items = []) {
  const unpaidItems = items.filter(item => item.category === 'unpaid');
  const countable = unpaidItems.filter(item => Number.isFinite(item.contractValue));

  const totalValue = countable.reduce((sum, item) => sum + item.contractValue, 0);

  return {
    totalValue,
    totalLabel: totalValue > 0
      ? `$${totalValue.toLocaleString('en-US')} USD`
      : '$0 USD',
    unpaidCount: unpaidItems.length,
    countableCount: countable.length,
    subtext: unpaidItems.length === 1
      ? 'Across 1 active unpaid initial item'
      : `Across ${unpaidItems.length} active unpaid initial items`,
  };
}
