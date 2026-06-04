import { Send, StopCircle, PlayCircle, Edit3, HeartHandshake } from 'lucide-react';
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
 *   StatusPill?: typeof StatusBadge;
 *   RowActions?: React.ComponentType;
 *   NameCell?: React.ComponentType<{ lead: LeadRow; unread?: boolean }>;
 *   formatSent?: (sent: string) => React.ReactNode;
 *   isLeadUnread?: (lead: LeadRow) => boolean;
 * }} handlers
 */
export function createLeadsColumns({
  navigate,
  onStop,
  onEdit,
  onMarkSold,
  actionLoading,
  StatusPill = StatusBadge,
  RowActions,
  NameCell,
  formatSent,
  isLeadUnread,
}) {
  const renderSent = formatSent || ((sent) => {
    if (sent === 'imported') return <span className="text-gs-muted">imported</span>;
    if (sent) return new Date(sent).toLocaleDateString();
    return '—';
  });

  const Actions = RowActions || function DefaultActions({ lead }) {
    const stopKey = `stop_${lead.row_number}`;
    const soldKey = `sold_${lead.row_number}`;
    const isSold = (lead.sold || '').toLowerCase() === 'yes';
    return (
      <div className="leads-actions" onClick={e => e.stopPropagation()} role="presentation">
        <button
          type="button"
          onClick={() => navigate('/send', { state: { lead } })}
          className="leads-action-btn leads-action-btn--send"
          title="Send template"
        >
          <Send size={13} />
        </button>
        <button
          type="button"
          onClick={() => onStop(lead)}
          disabled={actionLoading[stopKey]}
          className="leads-action-btn"
          title={lead.stop === 'yes' ? 'Remove stop' : 'Set stop'}
        >
          {actionLoading[stopKey]
            ? <Spinner size={13} />
            : lead.stop === 'yes' ? <PlayCircle size={13} /> : <StopCircle size={13} />}
        </button>
        <button
          type="button"
          onClick={() => onEdit(lead)}
          className="leads-action-btn"
          title="Edit"
        >
          <Edit3 size={13} />
        </button>
        <button
          type="button"
          onClick={() => !isSold && onMarkSold?.(lead)}
          disabled={isSold || actionLoading[soldKey]}
          className="leads-action-btn"
          title="Mark as Sold"
        >
          {actionLoading[soldKey] ? <Spinner size={13} /> : <HeartHandshake size={13} />}
        </button>
      </div>
    );
  };

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
      meta: columnMeta({ minWidth: 'min-w-[10rem]' }),
      cell: ({ row, getValue }) => {
        if (NameCell) {
          const unread = isLeadUnread ? isLeadUnread(row.original) : false;
          return <NameCell lead={row.original} unread={unread} />;
        }
        return getValue() || <span className="text-gs-muted">—</span>;
      },
    }),
    col.accessor('phone', {
      header: 'Phone',
      enableSorting: true,
      meta: columnMeta({ mono: true, minWidth: 'min-w-[7rem]' }),
      cell: ({ getValue }) => (
        <span className="leads-cell-phone">{getValue() || '—'}</span>
      ),
    }),
    col.accessor('email', {
      header: 'Email',
      enableSorting: true,
      meta: columnMeta({ minWidth: 'min-w-[8rem]' }),
      cell: ({ getValue }) => {
        const v = getValue();
        if (!v) return <span className="text-gs-muted">—</span>;
        return <span className="leads-cell-email" title={v}>{v}</span>;
      },
    }),
    col.accessor('notes', {
      header: 'Notes',
      enableSorting: true,
      meta: columnMeta({ minWidth: 'min-w-[4.5rem]' }),
      cell: ({ getValue }) => <StatusPill value={getValue()} />,
    }),
    col.accessor('status', {
      header: 'Status',
      enableSorting: true,
      meta: columnMeta({ minWidth: 'min-w-[5.5rem]' }),
      cell: ({ getValue }) => <StatusPill value={getValue()} />,
    }),
    col.accessor('sent', {
      header: 'Sent',
      enableSorting: true,
      meta: columnMeta({ minWidth: 'min-w-[5.5rem]' }),
      cell: ({ getValue }) => renderSent(getValue()),
    }),
    col.accessor('stop', {
      header: 'Stop',
      enableSorting: true,
      meta: columnMeta({ align: 'center', minWidth: 'min-w-[3.5rem]' }),
      cell: ({ getValue }) => (getValue() === 'yes' ? <StatusPill value="Stop" /> : null),
    }),
    col.accessor('sms_reply', {
      header: 'SMS',
      enableSorting: true,
      meta: columnMeta({ align: 'center', minWidth: 'min-w-[3.5rem]' }),
      cell: ({ getValue }) => (hasRealReply(getValue()) ? <StatusPill value="Replied" /> : null),
    }),
    col.accessor('email_reply', {
      header: 'Email',
      enableSorting: true,
      meta: columnMeta({ align: 'center', minWidth: 'min-w-[3.5rem]' }),
      cell: ({ getValue }) => (hasRealReply(getValue()) ? <StatusPill value="Replied" /> : null),
    }),
    col.accessor('error', {
      header: 'Error',
      enableSorting: true,
      meta: columnMeta({ minWidth: 'min-w-[7rem]' }),
      cell: ({ getValue }) => {
        const error = getValue();
        if (!error) return null;
        return (
          <span className="text-gs-danger text-xs truncate block max-w-[10rem]" title={error}>
            {error}
          </span>
        );
      },
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: columnMeta({ align: 'right', minWidth: 'min-w-[8.5rem]' }),
      cell: ({ row }) => (
        <Actions
          lead={row.original}
          navigate={navigate}
          onStop={onStop}
          onEdit={onEdit}
          onMarkSold={onMarkSold}
          actionLoading={actionLoading}
        />
      ),
    }),
  ];
}
