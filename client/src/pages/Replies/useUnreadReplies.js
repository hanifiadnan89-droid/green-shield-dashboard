import { useCallback, useEffect, useRef, useState } from 'react';
import { readKey, getLatestInbound } from './threadUtils.js';

const VIEWED_KEY = 'gs_viewed_replies';

function loadViewed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(VIEWED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveViewed(set) {
  localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
}

/**
 * Tracks per-conversation read state from latest message id (not sheet overwrite).
 */
export function useUnreadReplies() {
  const [viewed, setViewed] = useState(loadViewed);
  const viewedRef = useRef(viewed);
  const [pulseRows, setPulseRows] = useState(new Set());

  useEffect(() => {
    viewedRef.current = viewed;
  }, [viewed]);

  const isUnread = useCallback((lead, messages) => {
    const latestInbound = getLatestInbound(messages);
    if (!latestInbound) return false;
    const key = readKey(lead, messages);
    return !viewedRef.current.has(key);
  }, []);

  const markRead = useCallback((lead, messages) => {
    const key = readKey(lead, messages);
    setViewed(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      saveViewed(next);
      return next;
    });
    setPulseRows(prev => {
      if (!prev.has(lead.row_number)) return prev;
      const next = new Set(prev);
      next.delete(lead.row_number);
      return next;
    });
  }, []);

  const notifyNewInbound = useCallback((lead, messages, prevMessages) => {
    if (!prevMessages?.length) return false;
    const latest = getLatestInbound(messages);
    if (!latest) return false;
    const prevLatest = getLatestInbound(prevMessages);
    if (prevLatest?.id === latest.id) return false;

    const key = readKey(lead, messages);
    if (viewedRef.current.has(key)) return false;

    setPulseRows(prev => new Set(prev).add(lead.row_number));
    return true;
  }, []);

  return {
    isUnread,
    markRead,
    notifyNewInbound,
    pulseRows,
  };
}
