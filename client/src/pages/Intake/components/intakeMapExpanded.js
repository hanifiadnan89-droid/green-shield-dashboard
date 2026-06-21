import { useCallback, useRef, useState } from 'react';
import { captureMapView } from './intakeMapView.js';

export function useIntakeMapExpanded() {
  const [isExpanded, setIsExpanded] = useState(false);
  const savedViewRef = useRef(null);

  const rememberView = useCallback((map) => {
    const view = captureMapView(map);
    if (view) savedViewRef.current = view;
  }, []);

  const getSavedView = useCallback((fallbackCenter, fallbackZoom = 19) => {
    if (savedViewRef.current) return savedViewRef.current;
    return {
      lat: Number(fallbackCenter?.lat),
      lng: Number(fallbackCenter?.lng),
      zoom: fallbackZoom,
    };
  }, []);

  const openExpanded = useCallback((map) => {
    rememberView(map);
    setIsExpanded(true);
  }, [rememberView]);

  const closeExpanded = useCallback((map) => {
    rememberView(map);
    setIsExpanded(false);
  }, [rememberView]);

  const toggleExpanded = useCallback((map) => {
    if (isExpanded) closeExpanded(map);
    else openExpanded(map);
  }, [isExpanded, closeExpanded, openExpanded]);

  return {
    isExpanded,
    openExpanded,
    closeExpanded,
    toggleExpanded,
    getSavedView,
    rememberView,
  };
}
