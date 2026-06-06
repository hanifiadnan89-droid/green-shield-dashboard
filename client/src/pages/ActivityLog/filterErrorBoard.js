export const BOARD_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid Initial' },
  { id: 'pending', label: 'Pending' },
];

const BOARD_VISIBLE_CATEGORIES = new Set(['unpaid', 'pending']);

export function filterErrorBoardItems(items, category) {
  const boardItems = items.filter(item => BOARD_VISIBLE_CATEGORIES.has(item.category));
  if (!category || category === 'all') return boardItems;
  return boardItems.filter(item => item.category === category);
}
