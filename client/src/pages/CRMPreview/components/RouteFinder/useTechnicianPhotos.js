import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../../api/client.js';
import { resolveTechnicianPhotoUrl } from './technicianPhotoUtils.js';

/**
 * Loads technician headshots once per session (server caches for 7 days).
 */
export function useTechnicianPhotos() {
  const [byName, setByName] = useState(null);
  const [error, setError] = useState(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const data = await api.routes.technicianPhotos();
        if (!cancelled) {
          setByName(data.byName || {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Photo catalog unavailable');
          setByName({});
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const getPhotoUrl = useCallback(
    (techName) => resolveTechnicianPhotoUrl(techName, byName || {}),
    [byName],
  );

  return {
    byName: byName || {},
    loading: byName === null,
    error,
    getPhotoUrl,
  };
}
