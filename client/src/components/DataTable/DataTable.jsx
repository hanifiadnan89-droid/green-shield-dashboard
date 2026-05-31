import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import {
  cellClassNames,
  headerClassNames,
  DATA_TABLE_HEADER_LABEL_CLASS,
  DATA_TABLE_SCROLL_CLASS,
  DATA_TABLE_TABLE_CLASS,
} from './contract.js';

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
  tableClassName = DATA_TABLE_TABLE_CLASS,
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
  const wrapperClass = [DATA_TABLE_SCROLL_CLASS, className].filter(Boolean).join(' ');
  const theadClass = stickyHeader
    ? 'sticky top-0 z-10 bg-gs-bg/95 backdrop-blur-sm shadow-[inset_0_-1px_0_0_rgb(15_42_20/0.08)]'
    : undefined;

  return (
    <div className={wrapperClass} role="region" aria-label="Data table" tabIndex={0}>
      <table className={tableClassName}>
        <thead className={theadClass}>
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
                    scope="col"
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
                        className={`inline-flex items-center gap-1 ${DATA_TABLE_HEADER_LABEL_CLASS} hover:text-gs-text transition-colors cursor-pointer`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-gs-muted/70 shrink-0" aria-hidden>
                          {sorted === 'asc' ? <ChevronUp size={12} />
                            : sorted === 'desc' ? <ChevronDown size={12} />
                            : <ChevronsUpDown size={12} />}
                        </span>
                      </button>
                    ) : (
                      <span className={DATA_TABLE_HEADER_LABEL_CLASS}>
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
              <td colSpan={columnCount} className="td type-body-sm text-center py-16 text-gs-muted">
                {loadingContent ?? 'Loading…'}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="td type-body-sm text-center py-16 text-gs-muted">
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
