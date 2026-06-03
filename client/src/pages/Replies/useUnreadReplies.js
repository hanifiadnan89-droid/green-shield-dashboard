import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { getLatestInbound, inboundReadKey } from './threadUtils.js';
import { isInboundNewerThanRead } from './readState.js';

/**
 * Server-backed read state: lastReadAt vs lastInboundAt (persisted in sheet + server store).
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
        if (!m) continue;
        const entry = {
          lastReadAt: m.lastReadAt ?? prev[row]?.lastReadAt ?? null,
          lastReadInboundKey: m.lastReadInboundKey ?? prev[row]?.lastReadInboundKey ?? null,
        };
        if (
          entry.lastReadAt !== prev[row]?.lastReadAt
          || entry.lastReadInboundKey !== prev[row]?.lastReadInboundKey
        ) {
          next[row] = entry;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const isUnread = useCallback((lead, messages, metaForRow) => {
    const row = lead.row_number;
    const readAtMap = Object.fromEntries(
      Object.entries(readByRowRef.current).map(([k, v]) => [k, v?.lastReadAt ?? v?.lastReadInboundKey ?? v]),
    );
    return isInboundNewerThanRead(messages, metaForRow, readAtMap, row);
  }, []);

  const markRead = useCallback(async (lead, messages) => {
    const latestInbound = getLatestInbound(messages);
    const latestKey = inboundReadKey(latestInbound);
    if (!latestKey) return null;

    const row = lead.row_number;
    const alreadyRead = !isInboundNewerThanRead(
      messages,
      { lastInboundAt: latestInbound?.ts, lastReadAt: readByRowRef.current[row]?.lastReadAt },
      { [row]: readByRowRef.current[row]?.lastReadAt },
      row,
    );

    if (alreadyRead) {
      setPulseRows(prev => {
        if (!prev.has(row)) return prev;
        const next = new Set(prev);
        next.delete(row);
        return next;
      });
      return {
        lastReadInboundKey: latestKey,
        lastReadAt: readByRowRef.current[row]?.lastReadAt ?? latestInbound?.ts,
        unread: false,
      };
    }

    const optimisticReadAt = latestInbound?.ts || new Date().toISOString();
    setReadByRow(prev => ({
      ...prev,
      [row]: { lastReadAt: optimisticReadAt, lastReadInboundKey: latestKey },
    }));
    setPulseRows(prev => {
      if (!prev.has(row)) return prev;
      const next = new Set(prev);
      next.delete(row);
      return next;
    });

    try {
      const result = await api.messages.markRead(row, latestKey);
      if (result?.lastReadAt || result?.lastReadInboundKey) {
        setReadByRow(prev => ({
          ...prev,
          [row]: {
            lastReadAt: result.lastReadAt ?? prev[row]?.lastReadAt,
            lastReadInboundKey: result.lastReadInboundKey ?? latestKey,
          },
        }));
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

    const row = lead.row_number;
    if (!isInboundNewerThanRead(messages, null, { [row]: readByRowRef.current[row]?.lastReadAt }, row)) {
      return false;
    }

    setPulseRows(prev => new Set(prev).add(row));
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
