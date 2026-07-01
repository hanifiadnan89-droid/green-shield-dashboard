import { describe, expect, it } from 'vitest';
import { api } from '../client.js';

describe('client replies api', () => {
  it('exposes consolidated replies endpoints', () => {
    expect(typeof api.replies.get).toBe('function');
    expect(typeof api.replies.thread).toBe('function');
  });
});

