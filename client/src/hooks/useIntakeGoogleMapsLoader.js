import { useEffect, useState } from 'react';
import { classifyMapsError } from '../pages/CRMPreview/components/RouteFinder/mapLoadErrors.js';

const SCRIPT_ID = 'google-maps-intake-js';
const CALLBACK_NAME = '__gsIntakeMapsInit';
const LOAD_TIMEOUT_MS = 20000;

let loadPromise = null;

function getApiKey() {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

export function isIntakeMapsEnabled() {
  return !!getApiKey();
}

function removeScriptTag() {
  document.getElementById(SCRIPT_ID)?.remove();
  if (window[CALLBACK_NAME]) delete window[CALLBACK_NAME];
}

function mapsReady() {
  return Boolean(
    window.google?.maps?.Map
    && window.google?.maps?.places?.Autocomplete
    && window.google?.maps?.drawing?.DrawingManager
    && window.google?.maps?.geometry?.spherical,
  );
}

function loadScript() {
  const key = getApiKey();
  if (!key) {
    return Promise.reject(Object.assign(new Error('no_key'), { code: 'no_key' }));
  }

  if (mapsReady()) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    let settled = false;

    const fail = (code, detail = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      loadPromise = null;
      removeScriptTag();
      reject(Object.assign(new Error(code), { code, detail }));
    };

    const succeed = () => {
      if (settled) return;
      clearTimeout(timer);
      if (window.google?.maps?.Map && mapsReady()) {
        settled = true;
        resolve(window.google.maps);
      } else {
        fail('maps_api_unavailable');
      }
    };

    const timer = setTimeout(() => fail('timeout'), LOAD_TIMEOUT_MS);

    const prevAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      fail('auth_failure', 'gm_authFailure');
      if (typeof prevAuthFailure === 'function') prevAuthFailure();
    };

    window[CALLBACK_NAME] = () => {
      delete window[CALLBACK_NAME];
      succeed();
    };

    if (document.getElementById(SCRIPT_ID)) {
      removeScriptTag();
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.onerror = () => fail('script_error', 'script.onerror');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&libraries=places,drawing,geometry` +
      `&v=weekly&loading=async&callback=${CALLBACK_NAME}`;

    document.head.appendChild(script);
  }).catch((err) => {
    loadPromise = null;
    if (!err.code) {
      err.code = classifyMapsError(err.message);
      err.detail = err.message;
    }
    throw err;
  });

  return loadPromise;
}

export function useIntakeGoogleMapsLoader() {
  const [state, setState] = useState(() => {
    if (!getApiKey()) {
      return { status: 'no_key', errorCode: 'no_key', errorDetail: '' };
    }
    if (window.google?.maps?.Map) {
      return { status: 'ready', errorCode: null, errorDetail: '' };
    }
    return { status: 'loading', errorCode: null, errorDetail: '' };
  });

  useEffect(() => {
    if (!getApiKey()) {
      setState({ status: 'no_key', errorCode: 'no_key', errorDetail: '' });
      return;
    }

    let cancelled = false;

    loadScript()
      .then(() => {
        if (!cancelled) setState({ status: 'ready', errorCode: null, errorDetail: '' });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            errorCode: err.code || classifyMapsError(err.message),
            errorDetail: err.detail || err.message || '',
          });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return {
    status: state.status,
    errorCode: state.errorCode,
    errorDetail: state.errorDetail,
    hasKey: !!getApiKey(),
  };
}

export { loadScript as loadIntakeGoogleMaps };
