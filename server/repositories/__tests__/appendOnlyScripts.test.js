import { describe, expect, it } from 'vitest';

describe('append-only scripts', () => {
  it('can be imported without executing main commands', async () => {
    const backfill = await import('../../scripts/backfill-append-only-logs.mjs');
    const reconcile = await import('../../scripts/reconcile-append-only-logs.mjs');

    expect(backfill.main).toEqual(expect.any(Function));
    expect(reconcile.main).toEqual(expect.any(Function));
  });
});

