import { describe, it, expect, vi, afterEach } from 'vitest';
import { addMapsListener, runListenerCleanups } from '../propertyMapListeners.js';

describe('propertyMapListeners', () => {
  afterEach(() => {
    if (typeof globalThis.window !== 'undefined') {
      delete globalThis.window.google;
    }
  });

  it('returns null when target or event API is missing', () => {
    vi.stubGlobal('window', {});
    expect(addMapsListener(null, 'click', () => {})).toBeNull();
    expect(addMapsListener({}, 'click', () => {})).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns cleanup that removes the listener', () => {
    const removeListener = vi.fn();
    const listener = { id: 1 };
    vi.stubGlobal('window', {
      google: {
        maps: {
          event: {
            addListener: vi.fn(() => listener),
            removeListener,
          },
        },
      },
    });

    const target = {};
    const cleanup = addMapsListener(target, 'idle', () => {});
    expect(window.google.maps.event.addListener).toHaveBeenCalledWith(target, 'idle', expect.any(Function));

    cleanup?.();
    expect(removeListener).toHaveBeenCalledWith(listener);
    vi.unstubAllGlobals();
  });

  it('runListenerCleanups ignores failed cleanups', () => {
    const ok = vi.fn();
    const bad = vi.fn(() => { throw new Error('boom'); });
    expect(() => runListenerCleanups([bad, ok])).not.toThrow();
    expect(ok).toHaveBeenCalled();
  });
});
