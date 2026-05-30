import { Send, StopCircle, PlayCircle, Edit3 } from 'lucide-react';
import {
  createDataTableColumns,
  columnMeta,
} from '../components/DataTable/index.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import { hasRealReply } from './CRMPreview/mockData.js';

const col = createDataTableColumns();

/** @typedef {Record<string, unknown> & { row_number: number; name?: string }} LeadRow */

export const LEADS_INITIAL_SORTING = [{ id: 'row_number', desc: true }];

/**
 * TanStack column definitions for the Leads table.
 *
 * @param {{
 *   navigate: import('react-router-dom').NavigateFunction;
 *   onStop: (lead: LeadRow) => void;
 *   onEdit: (lead: LeadRow) => void;
 *   actionLoading: Record<string, boolean>;
 * }} handlers
 */
export function createLeadsColumns({ navigate, onStop, onEdit, actionLoading }) {
  return [
    col.accessor('row_number', {
      id: 'row_number',
      header: '#',
      enableSorting: true,
      meta: columnMeta({ className: 'hidden', headerClassName: 'hidden' }),
      cell: () => null,
    }),
    col.accessor('name', {
      header: 'Name',
      enableSorting: true,
      meta: columnMeta({ className: 'font-medium' }),
      cell: ({ getValue }) => getValue() || <span className="text-gs-muted">—</span>,
    }),
    col.accessor('phone', {
      header: 'Phone',
      enableSorting: true,
      meta: columnMeta({ mono: true, className: 'text-xs' }),
      cell: ({ getValue }) => getValue() || '—',
    }),
    col.accessor('email', {
      header: 'Email',
      enableSorting: true,
      meta: columnMeta({ className: 'text-xs text-gs-muted max-w-[140px]', truncate: true }),
      cell: ({ getValue }) => getValue() || '—',
    }),
    col.accessor('notes', {
      header: 'Notes',
      enableSorting: true,
      cell: ({ getValue }) => <StatusBadge value={getValue()} />,
    }),
    col.accessor('status', {
      header: 'Status',
      enableSorting: true,
      cell: ({ getValue }) => <StatusBadge value={getValue()} />,
    }),
    col.accessor('sent', {
      header: 'Sent',
      enableSorting: true,
      meta: columnMeta({ className: 'text-xs text-gs-muted' }),
      cell: ({ getValue }) => {
        const sent = getValue();
        if (sent === 'imported') return <span className="text-gs-muted">imported</span>;
        if (sent) return new Date(sent).toLocaleDateString();
        return '—';
      },
    }),
    col.accessor('stop', {
      header: 'Stop',
      enableSorting: true,
      cell: ({ getValue }) => (getValue() === 'yes' ? <StatusBadge value="yes" /> : null),
    }),
    col.accessor('sms_reply', {
      header: 'SMS',
      enableSorting: true,
      cell: ({ getValue }) => (hasRealReply(getValue()) ? <StatusBadge value="yes" /> : null),
    }),
    col.accessor('email_reply', {
      header: 'Email',
      enableSorting: true,
      cell: ({ getValue }) => (hasRealReply(getValue()) ? <StatusBadge value="yes" /> : null),
    }),
    col.accessor('error', {
      header: 'Error',
      enableSorting: true,
      meta: columnMeta({ className: 'max-w-[120px]' }),
      cell: ({ getValue }) => {
        const error = getValue();
        if (!error) return null;
        return (
          <span className="text-gs-danger text-xs truncate block" title={error}>
            ⚠ {error}
          </span>
        );
      },
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const lead = row.original;
        const stopKey = `stop_${lead.row_number}`;
        return (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()} role="presentation">
            <button
              type="button"
              onClick={() => navigate('/send', { state: { lead } })}
              className="p-1.5 rounded hover:bg-gs-accent/20 text-gs-accent cursor-pointer"
              title="Send template"
            >
              <Send size={13} />
            </button>
            <button
              type="button"
              onClick={() => onStop(lead)}
              disabled={actionLoading[stopKey]}
              className={`p-1.5 rounded cursor-pointer ${lead.stop === 'yes' ? 'hover:bg-gs-accent/20 text-gs-accent' : 'hover:bg-gs-danger/20 text-gs-danger'}`}
              title={lead.stop === 'yes' ? 'Remove stop' : 'Set stop'}
            >
              {actionLoading[stopKey]
                ? <Spinner size={13} />
                : lead.stop === 'yes' ? <PlayCircle size={13} /> : <StopCircle size={13} />}
            </button>
            <button
              type="button"
              onClick={() => onEdit(lead)}
              className="p-1.5 rounded hover:bg-gs-border text-gs-muted cursor-pointer"
              title="Edit"
            >
              <Edit3 size={13} />
            </button>
          </div>
        );
      },
    }),
  ];
}
