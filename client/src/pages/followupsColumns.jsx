import { Send, StopCircle } from 'lucide-react';
import {
  createDataTableColumns,
  columnMeta,
} from '../components/DataTable/index.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';

const col = createDataTableColumns();

/** @typedef {Record<string, unknown> & { row_number: number; name?: string; sent?: string }} FollowupRow */

export function daysSince(dateStr) {
  if (!dateStr || dateStr === 'imported') return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function DaysBadge({ days }) {
  if (days === null) return <span className="text-gs-muted">—</span>;
  if (days >= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gs-danger/12 border border-gs-danger/30 text-gs-danger">
        {days}d ago
      </span>
    );
  }
  if (days >= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gs-warn/12 border border-gs-warn/30 text-gs-warn">
        {days}d ago
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gs-accent/12 border border-gs-accent/30 text-gs-accent">
      {days}d ago
    </span>
  );
}

/**
 * TanStack column definitions for the Follow-ups table.
 *
 * @param {{
 *   navigate: import('react-router-dom').NavigateFunction;
 *   onStop: (lead: FollowupRow) => void;
 *   stopLoading: Record<string, boolean>;
 * }} handlers
 */
export function createFollowupsColumns({ navigate, onStop, stopLoading }) {
  return [
    col.accessor('name', {
      header: 'Name',
      enableSorting: true,
      meta: columnMeta({ className: 'font-semibold text-gs-text' }),
      cell: ({ getValue }) => getValue() || '—',
    }),
    col.accessor('phone', {
      header: 'Phone',
      enableSorting: true,
      meta: columnMeta({ mono: true, className: 'text-xs text-gs-muted' }),
      cell: ({ getValue }) => getValue() || '—',
    }),
    col.accessor('notes', {
      id: 'template',
      header: 'Template',
      enableSorting: true,
      cell: ({ getValue }) => <StatusBadge value={getValue()} />,
    }),
    col.accessor('sent', {
      header: 'Sent',
      enableSorting: true,
      meta: columnMeta({ className: 'text-xs text-gs-muted' }),
      cell: ({ getValue }) => {
        const sent = getValue();
        return sent && sent !== 'imported' ? new Date(sent).toLocaleDateString() : '—';
      },
    }),
    col.accessor(row => daysSince(row.sent), {
      id: 'days_since',
      header: 'Days Since',
      enableSorting: true,
      cell: ({ getValue }) => <DaysBadge days={getValue()} />,
    }),
    col.accessor('status', {
      header: 'Status',
      enableSorting: true,
      cell: ({ getValue }) => <StatusBadge value={getValue()} />,
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate('/send', { state: { lead } })}
              className="btn-info text-xs py-1 px-2.5"
            >
              <Send size={11} /> Send Again
            </button>
            <button
              type="button"
              onClick={() => onStop(lead)}
              disabled={stopLoading[lead.row_number]}
              className="btn-danger text-xs py-1 px-2.5"
            >
              {stopLoading[lead.row_number] ? <Spinner size={11} /> : <StopCircle size={11} />}
              Stop
            </button>
          </div>
        );
      },
    }),
  ];
}
