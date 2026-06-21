import { describe, expect, it, vi } from 'vitest';
import { notifyMapResize } from '../intakeMapFullscreen.js';

describe('intakeMapFullscreen', () => {
  it('triggers google maps resize immediately and on animation frame', () => {
    vi.useFakeTimers();
    const trigger = vi.fn();
    const map = {};
    globalThis.google = { maps: { event: { trigger } } };

    const rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    notifyMapResize(map);

    expect(trigger).toHaveBeenCalledTimes(1);
    rafCallbacks.forEach((cb) => cb());
    expect(trigger.mock.calls.length).toBeGreaterThanOrEqual(2);

    vi.advanceTimersByTime(250);
    expect(trigger.mock.calls.length).toBeGreaterThanOrEqual(4);

    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete globalThis.google;
  });
});
