import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearPropertyRecordsCache } from '../rentCastPropertyCache.js';
import { resetRentCastUsageForTests } from '../rentCastUsageTracker.js';
import {
  normalizeRentCastAddress,
  buildRentCastQueryAddress,
  mapRentCastPropertyRecord,
  lookupPropertyRecords,
  isRentCastConfigured,
} from '../rentCastPropertyRecords.js';

describe('rentCastPropertyRecords', () => {
  const originalKey = process.env.RENTCAST_API_KEY;
  const originalLimit = process.env.RENTCAST_MONTHLY_LOOKUP_LIMIT;

  beforeEach(() => {
    process.env.RENTCAST_API_KEY = 'test-rentcast-key';
    delete process.env.RENTCAST_MONTHLY_LOOKUP_LIMIT;
    clearPropertyRecordsCache();
    resetRentCastUsageForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = originalKey;
    if (originalLimit === undefined) delete process.env.RENTCAST_MONTHLY_LOOKUP_LIMIT;
    else process.env.RENTCAST_MONTHLY_LOOKUP_LIMIT = originalLimit;
  });

  it('reports configured status when API key is present', () => {
    expect(isRentCastConfigured()).toBe(true);
  });

  it('normalizes addresses consistently for cache keys', () => {
    const normalized = normalizeRentCastAddress({
      street: '5500 Grand Lake Dr',
      city: 'San Antonio',
      state: 'tx',
      zip: '78244-1234',
    });
    expect(normalized).toBe('5500 grand lake dr, san antonio, tx, 78244');
  });

  it('builds RentCast query address from components', () => {
    const query = buildRentCastQueryAddress({
      street: '5500 Grand Lake Dr',
      city: 'San Antonio',
      state: 'TX',
      zip: '78244',
    });
    expect(query).toBe('5500 Grand Lake Dr, San Antonio, TX, 78244');
  });

  it('maps RentCast property payload into intake records shape', () => {
    const mapped = mapRentCastPropertyRecord({
      propertyType: 'Single Family',
      yearBuilt: 1973,
      squareFootage: 1878,
      lotSize: 43560,
      bedrooms: 3,
      bathrooms: 2,
      ownerOccupied: true,
      lastSaleDate: '2024-11-18T00:00:00.000Z',
      lastSalePrice: 270000,
      taxAssessments: {
        2024: { value: 216513 },
      },
      features: { pool: true, garage: true },
    });

    expect(mapped.propertyType).toBe('Single Family');
    expect(mapped.lotAcreage).toBe('1.00 ac');
    expect(mapped.lastSalePriceLabel).toBe('$270,000');
    expect(mapped.taxAssessedValueLabel).toBe('$216,513');
    expect(mapped.salesNotes.length).toBeGreaterThan(0);
  });

  it('uses cache on second lookup without another RentCast API call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        propertyType: 'Single Family',
        squareFootage: 1800,
        lotSize: 8000,
        yearBuilt: 1998,
      }]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const params = {
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    };

    const first = await lookupPropertyRecords(params);
    const second = await lookupPropertyRecords(params);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.records.propertyType).toBe('Single Family');
  });

  it('requires confirmation after free tier is exhausted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ propertyType: 'Condo', squareFootage: 900 }]),
    });
    vi.stubGlobal('fetch', fetchMock);

    for (let i = 0; i < 50; i += 1) {
      clearPropertyRecordsCache();
      await lookupPropertyRecords({
        street: `${100 + i} Main St`,
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        confirmPaidLookup: true,
      });
    }

    const blocked = await lookupPropertyRecords({
      street: '999 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      confirmPaidLookup: false,
    });

    expect(blocked.requiresConfirmation).toBe(true);
    expect(blocked.records).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(50);
  });

  it('enforces optional monthly hard cap', async () => {
    process.env.RENTCAST_MONTHLY_LOOKUP_LIMIT = '2';
    resetRentCastUsageForTests();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ propertyType: 'Land' }]),
    });
    vi.stubGlobal('fetch', fetchMock);

    await lookupPropertyRecords({
      street: '1 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      confirmPaidLookup: true,
    });
    await lookupPropertyRecords({
      street: '2 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      confirmPaidLookup: true,
    });

    await expect(lookupPropertyRecords({
      street: '3 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      confirmPaidLookup: true,
    })).rejects.toMatchObject({ code: 'INTAKE_PROPERTY_RECORDS_LIMIT' });
  });

  it('returns unavailable records when RentCast has no match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    }));

    const result = await lookupPropertyRecords({
      street: '404 Missing Rd',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    });

    expect(result.records.unavailable).toBe(true);
    expect(result.message).toBe('Property records unavailable for this address');
  });

  it('treats RentCast 404 as address not found and tries fallback variants', async () => {
    let calls = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({ status: 404, ok: false });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: async () => ([{
          propertyType: 'Single Family',
          squareFootage: 1456,
          lotSize: 5227,
          yearBuilt: 2013,
        }]),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupPropertyRecords({
      street: '34B Cloudman St',
      city: 'Westbrook',
      state: 'ME',
      zip: '04092',
      verifiedAddress: '34B Cloudman Street, Westbrook, ME 04092-3404, USA',
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(result.records.propertyType).toBe('Single Family');
    expect(result.records.unavailable).not.toBe(true);
  });

  it('returns unavailable message after all fallback variants 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    }));

    const result = await lookupPropertyRecords({
      street: '999 Unknown Rd',
      city: 'Westbrook',
      state: 'ME',
      zip: '04092',
      verifiedAddress: '999 Unknown Road, Westbrook, ME 04092, USA',
    });

    expect(result.records.unavailable).toBe(true);
    expect(result.message).toBe('Property records unavailable for this address');
  });
});
