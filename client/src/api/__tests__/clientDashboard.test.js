import { describe, expect, it } from 'vitest';
import { api } from '../client.js';

describe('client dashboard api', () => {
  it('exposes api.dashboard.get for the live CRM preview', () => {
    expect(typeof api.dashboard.get).toBe('function');
  });
});
