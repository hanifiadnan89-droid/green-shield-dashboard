export const BOARD_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid Initial' },
  { id: 'pending', label: 'Pending' },
  { id: 'other', label: 'Other' },
];

export function isOtherBoardItem(item) {
  return item.category !== 'unpaid' && item.category !== 'pending';
}

export function filterErrorBoardItems(items, category) {
  if (!category || category === 'all') return items;
  if (category === 'unpaid') return items.filter(item => item.category === 'unpaid');
  if (category === 'pending') return items.filter(item => item.category === 'pending');
  if (category === 'other') return items.filter(isOtherBoardItem);
  return items;
}
