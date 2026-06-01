import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function useWorkflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.workflows.list();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { workflows, loading, load };
}
