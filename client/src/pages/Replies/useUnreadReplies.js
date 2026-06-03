import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { getLatestInbound, inboundReadKey } from './threadUtils.js';

/**
 * Server-backed read state keyed by stable inbound fingerprint (ts + body + channel).
 */
export function useUnreadReplies() {
  const [readByRow, setReadByRow] = useState({});
  const readByRowRef = useRef(readByRow);
  const [pulseRows, setPulseRows] = useState(new Set());

  readByRowRef.current = readByRow;

  const applyMetaReadState = useCallback((syncedMeta) => {
    if (!syncedMeta || typeof syncedMeta !== 'object') return;
    setReadByRow(prev => {
      const next = { ...prev };
      let changed = false;
      for (const [row, m] of Object.entries(syncedMeta)) {
        if (m?.lastReadInboundKey != null && next[row] !== m.lastReadInboundKey) {
          next[row] = m.lastReadInboundKey;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const isUnread = useCallback((lead, messages, metaForRow) => {
    const latestInbound = getLatestInbound(messages);
    if (!latestInbound) return false;
    const latestKey = inboundReadKey(latestInbound);
    if (!latestKey) return false;
    const readKey = metaForRow?.lastReadInboundKey ?? readByRowRef.current[lead.row_number];
    if (metaForRow?.unread === false) return false;
    if (metaForRow?.unread === true) return true;
    return readKey !== latestKey;
  }, []);

  const markRead = useCallback(async (lead, messages) => {
    const latestInbound = getLatestInbound(messages);
    const latestKey = inboundReadKey(latestInbound);
    if (!latestKey) return null;

    const row = lead.row_number;
    if (readByRowRef.current[row] === latestKey) {
      setPulseRows(prev => {
        if (!prev.has(row)) return prev;
        const next = new Set(prev);
        next.delete(row);
        return next;
      });
      return { lastReadInboundKey: latestKey, unread: false };
    }

    setReadByRow(prev => ({ ...prev, [row]: latestKey }));
    setPulseRows(prev => {
      if (!prev.has(row)) return prev;
      const next = new Set(prev);
      next.delete(row);
      return next;
    });

    try {
      const result = await api.messages.markRead(row, latestKey);
      if (result?.lastReadInboundKey) {
        setReadByRow(prev => ({ ...prev, [row]: result.lastReadInboundKey }));
      }
      return result;
    } catch (err) {
      console.warn('[Replies] markRead failed:', err.message);
      return null;
    }
  }, []);

  const notifyNewInbound = useCallback((lead, messages, prevMessages) => {
    if (!prevMessages?.length) return false;
    const latest = getLatestInbound(messages);
    if (!latest) return false;
    const prevLatest = getLatestInbound(prevMessages);
    if (prevLatest && inboundReadKey(prevLatest) === inboundReadKey(latest)) return false;

    const latestKey = inboundReadKey(latest);
    if (readByRowRef.current[lead.row_number] === latestKey) return false;

    setPulseRows(prev => new Set(prev).add(lead.row_number));
    return true;
  }, []);

  return {
    isUnread,
    markRead,
    notifyNewInbound,
    pulseRows,
    applyMetaReadState,
    readByRow,
  };
}
