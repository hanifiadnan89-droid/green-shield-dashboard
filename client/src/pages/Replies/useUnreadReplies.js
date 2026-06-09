import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { getLatestInbound, inboundReadKey } from './threadUtils.js';
import { isInboundNewerThanRead } from './readState.js';
import { recordLegacyViewedKey } from './legacyViewedKeys.js';

/**
 * Server-backed read state: lastReadAt + readInboundKeys (persisted in server store + sheet).
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
          readInboundKeys: m.readInboundKeys ?? prev[row]?.readInboundKeys ?? [],
        };
        if (
          entry.lastReadAt !== prev[row]?.lastReadAt
          || entry.lastReadInboundKey !== prev[row]?.lastReadInboundKey
          || JSON.stringify(entry.readInboundKeys) !== JSON.stringify(prev[row]?.readInboundKeys || [])
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
    return isInboundNewerThanRead(messages, metaForRow, readByRowRef.current, row);
  }, []);

  const markRead = useCallback(async (lead, messages) => {
    const inboundMessages = (messages || []).filter(m => m.direction === 'inbound');
    const inboundKeys = inboundMessages
      .map(inboundReadKey)
      .filter(Boolean);
    const latestInbound = getLatestInbound(messages);
    const latestKey = inboundReadKey(latestInbound);
    if (!latestKey) return null;

    const row = lead.row_number;
    const alreadyRead = !isInboundNewerThanRead(
      messages,
      {
        lastInboundAt: latestInbound?.ts,
        lastReadAt: readByRowRef.current[row]?.lastReadAt,
        lastReadInboundKey: readByRowRef.current[row]?.lastReadInboundKey,
        readInboundKeys: readByRowRef.current[row]?.readInboundKeys,
        unread: false,
      },
      readByRowRef.current,
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
        readInboundKeys: readByRowRef.current[row]?.readInboundKeys ?? inboundKeys,
        unread: false,
      };
    }

    const optimisticReadAt = latestInbound?.ts || new Date().toISOString();
    const previousRead = readByRowRef.current[row];
    setReadByRow(prev => ({
      ...prev,
      [row]: {
        lastReadAt: optimisticReadAt,
        lastReadInboundKey: latestKey,
        readInboundKeys: [...new Set([...(prev[row]?.readInboundKeys || []), ...inboundKeys])],
      },
    }));
    setPulseRows(prev => {
      if (!prev.has(row)) return prev;
      const next = new Set(prev);
      next.delete(row);
      return next;
    });

    try {
      const result = await api.messages.markReadAll(row);
      if (result?.lastReadAt || result?.lastReadInboundKey) {
        setReadByRow(prev => ({
          ...prev,
          [row]: {
            lastReadAt: result.lastReadAt ?? prev[row]?.lastReadAt,
            lastReadInboundKey: result.lastReadInboundKey ?? latestKey,
            readInboundKeys: result.readInboundKeys ?? prev[row]?.readInboundKeys ?? inboundKeys,
          },
        }));
        for (const key of result.readInboundKeys || inboundKeys) {
          recordLegacyViewedKey(row, key);
        }
      }
      return result;
    } catch (err) {
      console.warn('[Replies] markRead failed:', err.message);
      setReadByRow(prev => ({
        ...prev,
        [row]: previousRead || {},
      }));
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
    if (!isInboundNewerThanRead(messages, null, readByRowRef.current, row)) {
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
