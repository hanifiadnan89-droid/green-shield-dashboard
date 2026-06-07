import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../../api/client.js';
import { getLocalTechnicianPhotoCatalog } from '../../../../data/technicianPhotoManifest.js';
import { mergeTechnicianPhotoCatalog, resolveTechnicianPhoto } from './technicianPhotoUtils.js';

const photoLogCache = new Set();

function logPhotoMatch(message, detail) {
  if (import.meta.env.PROD) return;
  const key = `${detail?.techName}:${detail?.catalogKey || detail?.reason}:${message}`;
  if (photoLogCache.has(key)) return;
  photoLogCache.add(key);
  if (detail) {
    console.info(message, detail);
  } else {
    console.info(message);
  }
}

/**
 * Loads technician headshots once per session (server caches for 7 days).
 */
export function useTechnicianPhotos() {
  const [byName, setByName] = useState(() => getLocalTechnicianPhotoCatalog());
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
          setByName(mergeTechnicianPhotoCatalog(data.byName || {}));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Photo catalog unavailable');
          setByName(getLocalTechnicianPhotoCatalog());
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const getPhotoUrl = useCallback(
    (techName) => resolveTechnicianPhoto(techName, byName || {}, { logger: logPhotoMatch }).url,
    [byName],
  );

  return {
    byName: byName || {},
    loading: false,
    error,
    getPhotoUrl,
  };
}
