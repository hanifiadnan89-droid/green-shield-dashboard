import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { cellClassNames, headerClassNames } from './contract.js';

/**
 * Generic sortable data table shell for Leads / Followups (Phase 7).
 *
 * @template TData
 * @param {import('./contract.js').DataTableProps<TData>} props
 */
export default function DataTable({
  columns,
  data,
  initialSorting = [],
  isLoading = false,
  loadingContent = null,
  emptyContent = null,
  onRowClick,
  getRowId,
  stickyHeader = true,
  className = '',
  tableClassName = 'w-full',
}) {
  const [sorting, setSorting] = useState(initialSorting);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;

  return (
    <div className={`overflow-x-auto ${className}`.trim()}>
      <table className={tableClassName}>
        <thead className={stickyHeader ? 'sticky top-0 z-10 bg-gs-bg' : undefined}>
          {headerGroups.map(headerGroup => (
            <tr key={headerGroup.id} className="border-b border-gs-border">
              {headerGroup.headers.map(header => {
                const meta = header.column.columnDef.meta;
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();

                return (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className={headerClassNames(meta)}
                    aria-sort={
                      sorted === 'asc' ? 'ascending'
                        : sorted === 'desc' ? 'descending'
                        : canSort ? 'none'
                        : undefined
                    }
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 type-label-sm uppercase tracking-widest text-gs-muted hover:text-gs-text transition-colors font-semibold"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-gs-muted/80" aria-hidden>
                          {sorted === 'asc' ? <ChevronUp size={12} />
                            : sorted === 'desc' ? <ChevronDown size={12} />
                            : <ChevronsUpDown size={12} />}
                        </span>
                      </button>
                    ) : (
                      <span className="type-label-sm uppercase tracking-widest">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columnCount} className="td text-center py-16 text-gs-muted">
                {loadingContent ?? 'Loading…'}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="td text-center py-16 text-gs-muted">
                {emptyContent ?? 'No rows'}
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr
                key={row.id}
                className={`table-row ${onRowClick ? 'cursor-pointer' : ''}`.trim()}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {row.getVisibleCells().map(cell => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <td key={cell.id} className={cellClassNames(meta)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
