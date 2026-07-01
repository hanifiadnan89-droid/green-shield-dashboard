import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUserContext: vi.fn(),
  getDashboardData: vi.fn(),
}));

vi.mock('../../services/currentUserContext.js', () => ({
  getCurrentUserContext: mocks.getCurrentUserContext,
}));

vi.mock('../../services/crmData/dashboardQueries.js', () => ({
  getDashboardData: mocks.getDashboardData,
}));

import dashboardRouter from '../dashboard.js';

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
    json(payload) {
      this.body = payload;
      resolve(this);
      return this;
    },
  };
  return { res, done };
}

async function invokeRouter({ method = 'GET', url = '/', context = null }) {
  const req = {
    method,
    url,
    path: url,
    originalUrl: url,
    headers: {},
    body: {},
    currentUserContext: context,
  };
  const { res, done } = createMockResponse();
  await new Promise((resolve, reject) => {
    dashboardRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
    done.then(resolve).catch(reject);
  });
  return res;
}

describe('dashboard router', () => {
  const context = {
    userId: 'user_ah',
    organizationId: 'org_green_shield',
    role: 'admin',
    status: 'active',
    initials: 'AH',
    name: 'Adnan / AH',
  };

  beforeEach(() => {
    mocks.getCurrentUserContext.mockReset();
    mocks.getDashboardData.mockReset();
    mocks.getCurrentUserContext.mockReturnValue(context);
    mocks.getDashboardData.mockResolvedValue({
      leads: [{ row_number: 10, name: 'Lead' }],
      stats: { total: 1, sold: 0 },
      summary: { totalLeads: 1, soldLeads: 0 },
      followups: { followupsDueCount: 0 },
      pipelineMetrics: { statusTotal: 1, todayActivity: [] },
      activity: [],
      count: 1,
    });
  });

  it('returns the dashboard payload shape expected by the live CRM preview', async () => {
    const res = await invokeRouter({ context });

    expect(res.statusCode).toBe(200);
    expect(mocks.getCurrentUserContext).toHaveBeenCalled();
    expect(mocks.getDashboardData).toHaveBeenCalledWith(context);
    expect(res.body).toMatchObject({
      leads: [{ row_number: 10, name: 'Lead' }],
      stats: { total: 1, sold: 0 },
      summary: { totalLeads: 1, soldLeads: 0 },
      followups: { followupsDueCount: 0 },
      pipelineMetrics: { statusTotal: 1, todayActivity: [] },
      activity: [],
      count: 1,
    });
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getCurrentUserContext.mockReturnValue(null);

    const res = await invokeRouter({ context: null });

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  });
});
