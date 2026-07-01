import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { HISTORY_KEY } from './constants.js';
import { loadLegacyViewedKeys } from './legacyViewedKeys.js';
import { mergeMessageLists } from './mergeMessages.js';

/**
 * Server-backed message threads with one-time localStorage migration.
 * Threads are merged on sync — never replaced with a partial subset.
 */
export function useConversationThreads() {
  const [threads, setThreads] = useState({});
  const [meta, setMeta] = useState({});
  const [syncError, setSyncError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const migratedRef = useRef(false);
  const threadsRef = useRef(threads);
  const metaRef = useRef(meta);

  threadsRef.current = threads;
  metaRef.current = meta;

  const migrateLocalOnce = useCallback(async () => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const history = JSON.parse(raw);
      if (!history || typeof history !== 'object' || !Object.keys(history).length) return;
      await api.messages.migrateLocal(history);
    } catch (err) {
      console.warn('[Replies] localStorage migration failed:', err.message);
    }
  }, []);

  const applyThreadPayload = useCallback((rowNumber, messages, threadMeta) => {
    const key = Number(rowNumber);
    if (!key) return [];

    const existing = threadsRef.current[key] || [];
    const merged = mergeMessageLists(existing, messages || []);
    const nextMessages = (merged.length === 0 && existing.length > 0) ? existing : merged;

    setThreads(prev => ({ ...prev, [key]: nextMessages }));

    if (threadMeta && typeof threadMeta === 'object') {
      setMeta(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), ...threadMeta },
      }));
    }

    return nextMessages;
  }, []);

  const hydrateThreads = useCallback((initialThreads = {}, initialMeta = {}, { replace = true } = {}) => {
    const normalizedThreads = initialThreads && typeof initialThreads === 'object' ? initialThreads : {};
    const normalizedMeta = initialMeta && typeof initialMeta === 'object' ? initialMeta : {};

    setThreads(prev => {
      if (replace) return normalizedThreads;
      const next = { ...prev };
      for (const [rowKey, messages] of Object.entries(normalizedThreads)) {
        const row = Number(rowKey);
        const existing = prev[row] || [];
        const merged = mergeMessageLists(existing, messages || []);
        if (merged.length > 0 || existing.length === 0) {
          next[row] = merged;
        }
      }
      return next;
    });

    setMeta(prev => (replace ? normalizedMeta : { ...prev, ...normalizedMeta }));
  }, []);

  const syncLeads = useCallback(async (leads, { replace = false } = {}) => {
    if (!leads?.length) {
      if (replace) {
        setThreads({});
        setMeta({});
      }
      return threadsRef.current;
    }
    setSyncing(true);
    setSyncError(null);
    try {
      await migrateLocalOnce();
      const legacyViewedKeys = loadLegacyViewedKeys();
      const { threads: synced, meta: syncedMeta } = await api.messages.sync(leads, legacyViewedKeys);

      setThreads(prev => {
        if (replace) return synced || {};
        const next = { ...prev };
        for (const [rowKey, messages] of Object.entries(synced || {})) {
          const row = Number(rowKey);
          const existing = prev[row] || [];
          const merged = mergeMessageLists(existing, messages || []);
          if (merged.length > 0 || existing.length === 0) {
            next[row] = merged;
          }
        }
        return next;
      });

      setMeta(prev => (replace ? (syncedMeta || {}) : { ...prev, ...(syncedMeta || {}) }));

      if (!synced || typeof synced !== 'object') {
        console.warn('[Replies] Unexpected sync response shape');
      }
      return synced || {};
    } catch (err) {
      console.error('[Replies] Message sync failed:', err);
      setSyncError(err.message || 'Failed to load conversation history');
      return threadsRef.current;
    } finally {
      setSyncing(false);
    }
  }, [migrateLocalOnce]);

  const loadThread = useCallback(async (rowNumber) => {
    const row = Number(rowNumber);
    if (!row) return [];
    try {
      const payload = await api.replies.get({ rowNumber: row });
      const selected = payload?.selectedConversation || payload || {};
      return applyThreadPayload(row, selected.messages || [], selected.meta || payload?.meta);
    } catch (err) {
      try {
        const { messages, meta: threadMeta } = await api.messages.list(row);
        return applyThreadPayload(row, messages, threadMeta);
      } catch (fallbackErr) {
        console.warn(`[Replies] loadThread(${row}) failed:`, fallbackErr.message);
        return threadsRef.current[row] || [];
      }
    }
  }, [applyThreadPayload]);

  const appendOptimistic = useCallback((rowNumber, message) => {
    setThreads(prev => {
      const existing = prev[rowNumber] || [];
      const next = mergeMessageLists(existing, [message]);
      return { ...prev, [rowNumber]: next };
    });
    setMeta(prev => ({
      ...prev,
      [rowNumber]: {
        ...(prev[rowNumber] || {}),
        preview: message.body?.length > 120 ? `${message.body.slice(0, 120)}…` : message.body,
        lastAt: message.ts,
        lastMessage: message,
      },
    }));
  }, []);

  const getMessages = useCallback((rowNumber) => threads[rowNumber] || [], [threads]);

  const patchMeta = useCallback((rowNumber, patch) => {
    setMeta(prev => ({
      ...prev,
      [rowNumber]: { ...(prev[rowNumber] || {}), ...patch },
    }));
  }, []);

  return {
    threads,
    meta,
    syncError,
    syncing,
    syncLeads,
    hydrateThreads,
    loadThread,
    appendOptimistic,
    getMessages,
    patchMeta,
  };
}
