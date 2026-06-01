import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LIST_LIMIT } from './constants.js';

export default function useActivityLog() {
  const [log, setLog] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.activity.list(LIST_LIMIT);
      setLog(data.log || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirm('Clear all activity log entries?')) return;
    setClearing(true);
    try {
      await api.activity.clear();
      await load();
    } finally {
      setClearing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    log,
    total,
    loading,
    clearing,
    filter,
    setFilter,
    load,
    handleClear,
  };
}
