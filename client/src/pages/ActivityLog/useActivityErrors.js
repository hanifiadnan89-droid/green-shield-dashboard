import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';

const AUTO_REFRESH_MS = 3 * 60 * 1000;

export default function useActivityErrors() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completingRow, setCompletingRow] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.activityErrors.list();
      if (!mountedRef.current) return;
      setItems(data.items || []);
    } catch (err) {
      if (!mountedRef.current) return;
      const detail = [err.message, err.hint].filter(Boolean).join(' ');
      setError(detail || 'Failed to load error tasks');
      if (!silent) setItems([]);
    } finally {
      if (mountedRef.current && !silent) setLoading(false);
    }
  }, []);

  const complete = useCallback(async (rowNumber) => {
    setCompletingRow(rowNumber);
    try {
      await api.activityErrors.complete(rowNumber);
      setItems(prev => prev.filter(item => item.rowNumber !== rowNumber));
    } catch (err) {
      setError(err.message || 'Failed to mark task complete');
      throw err;
    } finally {
      setCompletingRow(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const timer = setInterval(() => load({ silent: true }), AUTO_REFRESH_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [load]);

  return {
    items,
    loading,
    error,
    completingRow,
    load,
    complete,
  };
}
