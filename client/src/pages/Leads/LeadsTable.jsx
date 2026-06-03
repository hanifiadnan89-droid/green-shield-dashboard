import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { motion, LayoutGroup } from 'motion/react';
import { ChevronDown, ChevronsUpDown, ChevronUp, MessageSquare, Mail, Phone } from 'lucide-react';
import { createLeadsColumns, LEADS_INITIAL_SORTING } from '../leadsColumns.jsx';
import { hasRealReply } from '../CRMPreview/mockData.js';
import { isLeadPriority, isLeadUnread } from './leadsFilters.js';
import LeadStatusPill from './LeadStatusPill.jsx';
import LeadRowActions from './LeadRowActions.jsx';

const STAGGER_CAP = 40;
const STAGGER_DELAY = 0.018;

function formatSent(sent) {
  if (sent === 'imported') return <span className="text-gs-muted text-xs">imported</span>;
  if (sent) return <span className="text-xs text-gs-muted">{new Date(sent).toLocaleDateString()}</span>;
  return <span className="text-gs-muted">—</span>;
}

function LeadNameCell({ lead, unread }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {unread && <span className="leads-cell-name__dot" aria-hidden />}
      <div className="min-w-0">
        <p className="leads-cell-name truncate">{lead.name || '—'}</p>
        <div className="leads-cell-meta">
          {lead.phone && (
            <span className="inline-flex items-center gap-0.5">
              <Phone size={9} /> SMS
            </span>
          )}
          {lead.email && (
            <span className="inline-flex items-center gap-0.5">
              <Mail size={9} /> Email
            </span>
          )}
          {(hasRealReply(lead.sms_reply) || hasRealReply(lead.email_reply)) && (
            <span className="inline-flex items-center gap-0.5 text-gs-accent">
              <MessageSquare size={9} /> Reply
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeadsTable({
  data,
  selectedRowNumber,
  onRowClick,
  navigate,
  onStop,
  onEdit,
  actionLoading,
}) {
  const [sorting, setSorting] = useState(LEADS_INITIAL_SORTING);

  const columns = useMemo(
    () => createLeadsColumns({
      navigate,
      onStop,
      onEdit,
      actionLoading,
      StatusPill: LeadStatusPill,
      RowActions: LeadRowActions,
      NameCell: LeadNameCell,
      formatSent,
    }),
    [navigate, onStop, onEdit, actionLoading]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: row => String(row.row_number),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="leads-table-scroll">
      <table className="leads-table">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                if (header.column.id === 'row_number') return null;
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th key={header.id} scope="col">
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-gs-muted/70 shrink-0 ml-0.5" aria-hidden>
                          {sorted === 'asc' ? <ChevronUp size={12} />
                            : sorted === 'desc' ? <ChevronDown size={12} />
                            : <ChevronsUpDown size={12} />}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          <LayoutGroup>
            {rows.map((row, index) => {
              const lead = row.original;
              const selected = selectedRowNumber === lead.row_number;
              const unread = isLeadUnread(lead);
              const priority = isLeadPriority(lead);
              const delay = Math.min(index, STAGGER_CAP) * STAGGER_DELAY;

              return (
                <motion.tr
                  key={row.id}
                  layout
                  className={[
                    'leads-row',
                    selected ? 'leads-row--selected' : '',
                    unread ? 'leads-row--unread' : '',
                    priority && !selected ? 'leads-row--priority' : '',
                    unread && !selected ? 'leads-row--pulse' : '',
                  ].filter(Boolean).join(' ')}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => onRowClick(lead)}
                >
                  {row.getVisibleCells()
                    .filter(cell => cell.column.id !== 'row_number')
                    .map((cell, cellIndex) => (
                      <td key={cell.id} className={cellIndex === 0 ? 'relative overflow-hidden' : ''}>
                        {cellIndex === 0 && <span className="leads-row__shimmer" aria-hidden />}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                </motion.tr>
              );
            })}
          </LayoutGroup>
        </tbody>
      </table>
    </div>
  );
}
