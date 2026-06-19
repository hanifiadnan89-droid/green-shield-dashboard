/**
 * Safely attach Google Maps event listeners — returns a cleanup function.
 * @param {unknown} target
 * @param {string} eventName
 * @param {(...args: unknown[]) => void} handler
 * @returns {(() => void)|null}
 */
export function addMapsListener(target, eventName, handler) {
  const eventApi = typeof window !== 'undefined' ? window.google?.maps?.event : undefined;
  if (!target || !eventApi?.addListener) return null;

  try {
    const listener = eventApi.addListener(target, eventName, handler);
    return () => {
      try {
        if (listener && eventApi.removeListener) {
          eventApi.removeListener(listener);
        }
      } catch {
        /* map may already be torn down */
      }
    };
  } catch {
    return null;
  }
}

/** @param {Array<(() => void)|null>} cleanups */
export function runListenerCleanups(cleanups = []) {
  for (const cleanup of cleanups) {
    try {
      cleanup?.();
    } catch {
      /* ignore teardown errors */
    }
  }
}
