export const BOARD_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid Initial' },
  { id: 'pending', label: 'Pending' },
  { id: 'line_busy', label: 'Line Busy' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'other', label: 'Other' },
];

export function filterErrorBoardItems(items, category) {
  if (!category || category === 'all') return items;
  return items.filter(item => item.category === category);
}
