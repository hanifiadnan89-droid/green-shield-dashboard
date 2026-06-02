import { useEffect, useState } from 'react';

let loadPromise = null;

function getApiKey() {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

function loadScript() {
  const key = getApiKey();
  if (!key) return Promise.reject(new Error('no_key'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const id = 'google-maps-js';
      if (document.getElementById(id)) {
        const wait = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(wait);
            resolve(window.google.maps);
          }
        }, 50);
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      script.onload = () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error('Google Maps failed to load'));
      };
      script.onerror = () => reject(new Error('Google Maps script error'));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

export function useGoogleMapsLoader() {
  const [status, setStatus] = useState(() => (
    getApiKey() ? 'loading' : 'no_key'
  ));

  useEffect(() => {
    if (!getApiKey()) {
      setStatus('no_key');
      return;
    }
    let cancelled = false;
    loadScript()
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  return { status, hasKey: !!getApiKey() };
}
