/**
 * Column definition helpers — thin wrapper around TanStack Table's columnHelper.
 *
 * Usage (in leadsColumns.jsx / followupsColumns.jsx, Phase 7 step 4+):
 *
 *   import { createDataTableColumns } from '../components/DataTable/columns.js';
 *   const col = createDataTableColumns<LeadRow>();
 *   export const leadsColumns = [
 *     col.accessor('name', {
 *       header: 'Name',
 *       meta: columnMeta({ className: 'font-medium' }),
 *     }),
 *   ];
 */

import { createColumnHelper } from '@tanstack/react-table';

/**
 * Create a typed column helper for a row shape.
 *
 * @template TData
 * @returns {import('@tanstack/react-table').ColumnHelper<TData>}
 */
export function createDataTableColumns() {
  return createColumnHelper();
}

export { createColumnHelper };
