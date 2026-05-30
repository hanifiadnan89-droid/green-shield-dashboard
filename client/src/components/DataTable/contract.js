/**
 * Phase 7 — DataTable contract and column definition structure.
 *
 * Pages (Leads, Followups) own data fetching, filtering, and row actions.
 * DataTable owns presentation: header, body, client-side sort, scroll shell.
 */

/** @typedef {import('@tanstack/react-table').ColumnDef} ColumnDef */
/** @typedef {import('@tanstack/react-table').SortingState} SortingState */
/** @typedef {import('@tanstack/react-table').Row} Row */
/** @typedef {import('@tanstack/react-table').Header} Header */

/**
 * Column `meta` shape — use with `createColumnHelper` / `columnHelper.accessor`.
 *
 * @typedef {Object} DataTableColumnMeta
 * @property {string} [className] - Extra classes on body cells (`<td>`).
 * @property {string} [headerClassName] - Extra classes on header cells (`<th>`).
 * @property {'left'|'center'|'right'} [align='left'] - Horizontal alignment.
 * @property {boolean} [mono] - Apply `type-mono` on cell content.
 * @property {boolean} [truncate] - Truncate overflowing cell text.
 */

/**
 * @typedef {Object} DataTableProps
 * @template TData
 * @property {ColumnDef<TData, unknown>[]} columns - TanStack column definitions.
 * @property {TData[]} data - Row data (already filtered by the page).
 * @property {SortingState} [initialSorting] - Initial sort state (e.g. row_number desc).
 * @property {boolean} [isLoading] - Show loading slot instead of table body.
 * @property {import('react').ReactNode} [loadingContent] - Custom loading UI.
 * @property {import('react').ReactNode} [emptyContent] - Custom empty UI when data is [].
 * @property {(row: Row<TData>) => void} [onRowClick] - Optional row click handler.
 * @property {(originalRow: TData, index: number, parent?: Row<TData>) => string} [getRowId]
 * @property {boolean} [stickyHeader=true] - Sticky table header within scroll container.
 * @property {string} [className] - Wrapper classes (scroll container).
 * @property {string} [tableClassName] - Classes on `<table>`.
 */

/** Recognized keys on column.meta for documentation and helpers. */
export const DATA_TABLE_COLUMN_META_KEYS = [
  'className',
  'headerClassName',
  'align',
  'mono',
  'truncate',
];

export const COLUMN_ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * Build a column meta object with defaults.
 *
 * @param {DataTableColumnMeta} [meta]
 * @returns {DataTableColumnMeta}
 */
export function columnMeta(meta = {}) {
  return { align: 'left', ...meta };
}

/**
 * Merge alignment, mono, and truncate into cell class names.
 *
 * @param {DataTableColumnMeta | undefined} meta
 * @returns {string}
 */
export function cellClassNames(meta) {
  const align = COLUMN_ALIGN_CLASS[meta?.align] || COLUMN_ALIGN_CLASS.left;
  const parts = ['td', align];
  if (meta?.mono) parts.push('type-mono');
  if (meta?.truncate) parts.push('max-w-[200px] truncate');
  if (meta?.className) parts.push(meta.className);
  return parts.filter(Boolean).join(' ');
}

/**
 * Header cell class names from column meta.
 *
 * @param {DataTableColumnMeta | undefined} meta
 * @returns {string}
 */
export function headerClassNames(meta) {
  const align = COLUMN_ALIGN_CLASS[meta?.align] || COLUMN_ALIGN_CLASS.left;
  const parts = ['th', align];
  if (meta?.headerClassName) parts.push(meta.headerClassName);
  return parts.filter(Boolean).join(' ');
}
