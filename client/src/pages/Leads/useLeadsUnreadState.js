import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { filterConversationLeads, hasConversationSignal } from '../Replies/conversationLeadFilter.js';
import { getLatestInbound, inboundReadKey } from '../Replies/threadUtils.js';

/**
 * Leads unread highlighting — same server read protocol as Replies:
 * unread when lastInboundAt > lastReadAt (via /api/messages/unread-count).
 *
 * Avoids syncing full thread history for every conversation lead on page load.
 */
export function useLeadsUnreadState(leads) {
  const [unreadRows, setUnreadRows] = useState(() => new Set());
  const refreshTimer = useRef(null);
  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  const refreshUnread = useCallback(async () => {
    const replyLeads = filterConversationLeads(leadsRef.current);
    if (!replyLeads.length) {
      setUnreadRows(new Set());
      return;
    }
    try {
      const { rowNumbers, count } = await api.messages.unreadCount(replyLeads);
      const rows = Array.isArray(rowNumbers) ? rowNumbers : [];
      setUnreadRows(new Set(rows));
      window.dispatchEvent(new CustomEvent('replies-unread-count', {
        detail: { count: typeof count === 'number' ? count : rows.length },
      }));
    } catch (err) {
      console.warn('[Leads] unread count failed:', err.message);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void refreshUnread();
    }, 200);
  }, [refreshUnread]);

  useEffect(() => {
    scheduleRefresh();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [leads, scheduleRefresh]);

  useEffect(() => {
    const onUnreadEvent = () => scheduleRefresh();
    window.addEventListener('replies-unread-count', onUnreadEvent);
    return () => window.removeEventListener('replies-unread-count', onUnreadEvent);
  }, [scheduleRefresh]);

  const isLeadUnread = useCallback(
    (lead) => unreadRows.has(lead.row_number),
    [unreadRows],
  );

  const markLeadRead = useCallback(async (lead) => {
    if (!hasConversationSignal(lead)) return null;
    try {
      const { messages } = await api.messages.list(lead.row_number);
      const latestInbound = getLatestInbound(messages);
      const key = inboundReadKey(latestInbound);
      if (!key) {
        setUnreadRows(prev => {
          const next = new Set(prev);
          next.delete(lead.row_number);
          return next;
        });
        return null;
      }
      const result = await api.messages.markRead(lead.row_number, key);
      setUnreadRows(prev => {
        const next = new Set(prev);
        next.delete(lead.row_number);
        return next;
      });
      scheduleRefresh();
      return result;
    } catch (err) {
      console.warn('[Leads] markRead failed:', err.message);
      return null;
    }
  }, [scheduleRefresh]);

  const emptyPulse = useMemo(() => new Set(), []);

  return {
    isLeadUnread,
    markLeadRead,
    pulseRows: emptyPulse,
    refreshReadState: refreshUnread,
  };
}
