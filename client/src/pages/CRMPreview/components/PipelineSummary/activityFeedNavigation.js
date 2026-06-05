/**
 * Maps dashboard activity feed items to CRM routes with lead selection.
 * @typedef {Object} ActivityFeedItem
 * @property {string} id
 * @property {string} type
 * @property {string} text
 * @property {number} rowNumber
 * @property {string} [leadName]
 * @property {string} [notes]
 * @property {'sms'|'email'|null} [replyChannel]
 */

export function templateNotesKey(notes = '') {
  const raw = String(notes).toLowerCase().trim();
  if (raw === 't/m') return 'tm';
  return raw;
}

/**
 * @param {ActivityFeedItem} item
 * @returns {{ pathname: string, search?: string, state?: Record<string, unknown> }}
 */
export function getActivityFeedDestination(item) {
  const row = item.rowNumber;
  if (row == null || Number.isNaN(Number(row))) {
    return { pathname: '/leads' };
  }

  const rowStr = String(row);

  switch (item.type) {
    case 'reply':
      return {
        pathname: '/replies',
        search: `?row=${rowStr}`,
        state: { selectRowNumber: row, fromActivityFeed: true },
      };

    case 'overdue':
      return {
        pathname: '/followups',
        search: `?filter=overdue&row=${rowStr}`,
        state: { selectRowNumber: row, quickFilter: 'overdue', fromActivityFeed: true },
      };

    case 'error':
      return {
        pathname: '/leads',
        search: `?category=errors&row=${rowStr}`,
        state: { selectRowNumber: row, fromActivityFeed: true },
      };

    case 'new':
      return {
        pathname: '/leads',
        search: `?row=${rowStr}`,
        state: { selectRowNumber: row, fromActivityFeed: true },
      };

    case 'sent': {
      const params = new URLSearchParams();
      params.set('row', rowStr);
      const notes = templateNotesKey(item.notes || '');
      if (notes === 'ag') {
        params.set('notes', 'ag');
        params.set('quick', 'agreement');
      } else if (notes === 'iq') {
        params.set('notes', 'iq');
      } else if (notes) {
        params.set('notes', item.notes?.toLowerCase().trim() || notes);
      } else {
        params.set('category', 'sent');
        params.set('quick', 'sent');
      }
      return {
        pathname: '/leads',
        search: `?${params.toString()}`,
        state: { selectRowNumber: row, fromActivityFeed: true },
      };
    }

    default:
      return {
        pathname: '/leads',
        search: `?row=${rowStr}`,
        state: { selectRowNumber: row, fromActivityFeed: true },
      };
  }
}
