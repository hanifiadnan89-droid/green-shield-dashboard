import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLeads: vi.fn(),
  appendLead: vi.fn(),
  updateLead: vi.fn(),
  currentUserContext: vi.fn(),
  appendLog: vi.fn(),
  transferLeadOwnership: vi.fn(),
  resolveGoogleSheetsConfig: vi.fn(),
}));

vi.mock('../../services/sheets.js', () => ({
  getLeads: mocks.getLeads,
  appendLead: mocks.appendLead,
  updateLead: mocks.updateLead,
}));

vi.mock('../../services/integrationResolver.js', () => ({
  resolveGoogleSheetsConfig: mocks.resolveGoogleSheetsConfig,
}));

vi.mock('../../services/currentUserContext.js', () => ({
  getCurrentUserContext: mocks.currentUserContext,
}));

vi.mock('../../services/activity.js', () => ({
  appendLog: mocks.appendLog,
}));

vi.mock('../../services/leadOwnership.js', () => ({
  ...mocks,
  transferLeadOwnership: mocks.transferLeadOwnership,
  getLeadOwner: vi.fn((lead) => lead),
  isLeadOwnedByUser: vi.fn((context, lead) => Boolean(
    context?.userId
    && lead
    && context.userId === lead.ownerUserId
    && context.organizationId === lead.organizationId,
  )),
}));

import leadsRouter from '../leads.js';

function createMockResponse() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
    },
    json(payload) {
      this.body = payload;
      resolve(this);
      return this;
    },
    send(payload) {
      this.body = payload;
      resolve(this);
      return this;
    },
  };
  return { res, done };
}

async function invokeRouter({ method = 'GET', url = '/', body = null, context = null }) {
  const req = {
    method,
    url,
    path: url,
    originalUrl: url,
    headers: {},
    body,
    currentUserContext: context,
  };
  const { res, done } = createMockResponse();
  await new Promise((resolve, reject) => {
    leadsRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
    done.then(resolve).catch(reject);
  });
  return res;
}

describe('leads router sheets context pass-through', () => {
  let originalTestMode;
  let originalScopedFlag;
  const context = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
    initials: 'AH',
    name: 'Adnan / AH',
  };

  beforeEach(() => {
    originalTestMode = process.env.TEST_MODE;
    originalScopedFlag = process.env.SCOPED_LEAD_ACCESS_ENABLED;
    process.env.TEST_MODE = 'false';
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'false';
    mocks.getLeads.mockReset();
    mocks.appendLead.mockReset();
    mocks.updateLead.mockReset();
    mocks.currentUserContext.mockReset();
    mocks.appendLog.mockReset();
    mocks.transferLeadOwnership.mockReset();
    mocks.resolveGoogleSheetsConfig.mockReset();
    mocks.currentUserContext.mockReturnValue(context);
    mocks.resolveGoogleSheetsConfig.mockReturnValue({
      masterLeadSheetId: 'sheet-master',
      leadResponsesSheetId: 'sheet-responses',
      customerDatabaseSheetId: 'sheet-customers',
      source: 'profile',
      configured: true,
    });
    mocks.getLeads.mockResolvedValue([
      {
        row_number: 2,
        name: 'Alice',
        organizationId: 'org_green_shield',
        ownerUserId: 'user_rep',
        createdBy: 'user_rep',
        updatedBy: 'user_rep',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
        source: 'store',
      },
      {
        row_number: 3,
        name: 'Jordan',
        organizationId: 'org_green_shield',
        ownerUserId: 'user_manager',
        createdBy: 'user_manager',
        updatedBy: 'user_manager',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
        source: 'store',
      },
    ]);
    mocks.appendLead.mockResolvedValue({ appended: true });
    mocks.updateLead.mockResolvedValue({ updated: true });
    mocks.transferLeadOwnership.mockReturnValue({
      rowNumber: '2',
      organizationId: 'org_green_shield',
      ownerUserId: 'user_manager',
      createdBy: 'user_ah',
      updatedBy: 'user_manager',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:01:00.000Z',
      source: 'store',
    });
  });

  afterEach(() => {
    if (originalTestMode == null) delete process.env.TEST_MODE;
    else process.env.TEST_MODE = originalTestMode;
    if (originalScopedFlag == null) delete process.env.SCOPED_LEAD_ACCESS_ENABLED;
    else process.env.SCOPED_LEAD_ACCESS_ENABLED = originalScopedFlag;
  });

  it('passes the current user context into the leads sheet service', async () => {
    const listRes = await invokeRouter({ method: 'GET', url: '/', context });
    expect(listRes.statusCode).toBe(200);
    expect(mocks.getLeads).toHaveBeenCalledWith(context);
    expect(listRes.body.leads).toHaveLength(2);
    expect(listRes.body.leads[0]).toHaveProperty('ownership');
    expect(listRes.body.leads[0]).toHaveProperty('visibility');

    const createRes = await invokeRouter({
      method: 'POST',
      url: '/',
      context,
      body: { name: 'Jamie', email: 'jamie@example.com' },
    });
    expect(createRes.statusCode).toBe(200);
    expect(mocks.appendLead).toHaveBeenCalledWith({ name: 'Jamie', email: 'jamie@example.com' }, context);
  });

  it('keeps flag-off lead reads unfiltered for AH', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'false';
    const listRes = await invokeRouter({ method: 'GET', url: '/', context });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.count).toBe(2);
    expect(listRes.body.leads.map((lead) => lead.row_number)).toEqual([2, 3]);
  });

  it('filters sales reps to owned leads when scoped access is enabled', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';
    const salesRepContext = {
      ...context,
      userId: 'user_rep',
      initials: 'SR',
      role: 'sales_rep',
      isAdmin: false,
      isManager: false,
      isSalesRep: true,
    };
    mocks.currentUserContext.mockReturnValue(salesRepContext);

    const listRes = await invokeRouter({ method: 'GET', url: '/', context: salesRepContext });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.count).toBe(1);
    expect(listRes.body.leads).toHaveLength(1);
    expect(listRes.body.leads[0].row_number).toBe(2);
    expect(listRes.body.leads[0].visibility).toMatchObject({
      canView: true,
      canEdit: true,
      scope: 'owned',
    });
  });

  it('allows managers to see all leads when scoped access is enabled', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';
    const managerContext = {
      ...context,
      userId: 'user_manager',
      initials: 'MG',
      role: 'manager',
      isAdmin: false,
      isManager: true,
      isSalesRep: false,
    };
    mocks.currentUserContext.mockReturnValue(managerContext);

    const listRes = await invokeRouter({ method: 'GET', url: '/', context: managerContext });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.count).toBe(2);
  });

  it('blocks inactive users when scoped access is enabled', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';
    const inactiveContext = {
      ...context,
      userId: 'user_inactive',
      initials: 'IN',
      role: 'sales_rep',
      status: 'inactive',
      isAdmin: false,
      isManager: false,
      isSalesRep: true,
    };
    mocks.currentUserContext.mockReturnValue(inactiveContext);

    const listRes = await invokeRouter({ method: 'GET', url: '/', context: inactiveContext });
    expect(listRes.statusCode).toBe(403);
    expect(listRes.body.code).toBe('USER_INACTIVE');
  });

  it('allows managers to transfer lead ownership and blocks sales reps', async () => {
    mocks.currentUserContext.mockReturnValue({
      ...context,
      userId: 'user_manager',
      initials: 'MG',
      role: 'manager',
      isAdmin: false,
      isManager: true,
      isSalesRep: false,
    });

    const transferRes = await invokeRouter({
      method: 'POST',
      url: '/2/transfer',
      context: {
        ...context,
        userId: 'user_manager',
        initials: 'MG',
        role: 'manager',
        isAdmin: false,
        isManager: true,
        isSalesRep: false,
      },
      body: { ownerUserId: 'user_manager' },
    });

    expect(transferRes.statusCode).toBe(200);
    expect(mocks.transferLeadOwnership).toHaveBeenCalledWith(2, 'user_manager', expect.objectContaining({
      userId: 'user_manager',
    }));

    mocks.currentUserContext.mockReturnValue({
      ...context,
      userId: 'user_rep',
      initials: 'SR',
      role: 'sales_rep',
      isAdmin: false,
      isManager: false,
      isSalesRep: true,
    });

    const forbiddenRes = await invokeRouter({
      method: 'POST',
      url: '/2/transfer',
      context: {
        ...context,
        userId: 'user_rep',
        initials: 'SR',
        role: 'sales_rep',
        isAdmin: false,
        isManager: false,
        isSalesRep: true,
      },
      body: { ownerUserId: 'user_ah' },
    });

    expect(forbiddenRes.statusCode).toBe(403);
    expect(forbiddenRes.body.code).toBe('MANAGER_REQUIRED');
  });

  it('blocks sales reps from editing leads they do not own when scoped access is enabled', async () => {
    process.env.SCOPED_LEAD_ACCESS_ENABLED = 'true';
    const salesRepContext = {
      ...context,
      userId: 'user_rep',
      initials: 'SR',
      role: 'sales_rep',
      isAdmin: false,
      isManager: false,
      isSalesRep: true,
    };
    mocks.currentUserContext.mockReturnValue(salesRepContext);

    const updateRes = await invokeRouter({
      method: 'PUT',
      url: '/3',
      context: salesRepContext,
      body: { notes: 'updated note' },
    });

    expect(updateRes.statusCode).toBe(403);
    expect(updateRes.body.code).toBe('LEAD_ACCESS_DENIED');
    expect(mocks.updateLead).not.toHaveBeenCalled();
  });
});
