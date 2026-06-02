import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { HISTORY_KEY } from './constants.js';

/**
 * Server-backed message threads with one-time localStorage migration.
 */
export function useConversationThreads() {
  const [threads, setThreads] = useState({});
  const [meta, setMeta] = useState({});
  const [syncError, setSyncError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const migratedRef = useRef(false);
  const threadsRef = useRef(threads);

  threadsRef.current = threads;

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

  const syncLeads = useCallback(async (leads) => {
    if (!leads?.length) {
      setThreads({});
      setMeta({});
      return {};
    }
    setSyncing(true);
    setSyncError(null);
    try {
      await migrateLocalOnce();
      const { threads: synced, meta: syncedMeta } = await api.messages.sync(leads);
      setThreads(synced || {});
      setMeta(syncedMeta || {});
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

  const appendOptimistic = useCallback((rowNumber, message) => {
    setThreads(prev => {
      const existing = prev[rowNumber] || [];
      const next = [...existing, message];
      return { ...prev, [rowNumber]: next };
    });
    setMeta(prev => ({
      ...prev,
      [rowNumber]: {
        preview: message.body?.length > 120 ? `${message.body.slice(0, 120)}…` : message.body,
        lastAt: message.ts,
        lastMessage: message,
      },
    }));
  }, []);

  const getMessages = useCallback((rowNumber) => threads[rowNumber] || [], [threads]);

  return {
    threads,
    meta,
    syncError,
    syncing,
    syncLeads,
    appendOptimistic,
    getMessages,
  };
}
