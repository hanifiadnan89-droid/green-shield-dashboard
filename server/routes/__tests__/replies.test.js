import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUserContext: vi.fn(),
  getVisibleReplyThreads: vi.fn(),
  getReplyThread: vi.fn(),
}));

vi.mock('../../services/currentUserContext.js', () => ({
  getCurrentUserContext: mocks.getCurrentUserContext,
}));

vi.mock('../../services/crmData/replies/replyQueries.js', () => ({
  getVisibleReplyThreads: mocks.getVisibleReplyThreads,
  getReplyThread: mocks.getReplyThread,
}));

import repliesRouter from '../replies.js';

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
    params: {},
    currentUserContext: context,
  };
  const { res, done } = createMockResponse();
  await new Promise((resolve, reject) => {
    repliesRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
    done.then(resolve).catch(reject);
  });
  return res;
}

describe('replies router', () => {
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
    mocks.getVisibleReplyThreads.mockReset();
    mocks.getReplyThread.mockReset();
    mocks.getCurrentUserContext.mockReturnValue(context);
    mocks.getVisibleReplyThreads.mockResolvedValue({
      leads: [{ row_number: 18, name: 'Reply Lead' }],
      threads: { 18: [{ id: '1', body: 'Need help' }] },
      meta: { 18: { preview: 'Need help', unread: true } },
      summary: { totalThreads: 1, unreadCount: 1 },
      unreadCount: 1,
      sidebar: [{ rowNumber: 18, preview: 'Need help', unread: true }],
      count: 1,
    });
    mocks.getReplyThread.mockResolvedValue({
      lead: { row_number: 18, name: 'Reply Lead' },
      messages: [{ id: '1', body: 'Need help' }],
      meta: { preview: 'Need help', unread: true },
      summary: { totalThreads: 1, unreadCount: 1 },
    });
  });

  it('returns the consolidated replies payload', async () => {
    const res = await invokeRouter({ context });

    expect(res.statusCode).toBe(200);
    expect(mocks.getCurrentUserContext).toHaveBeenCalled();
    expect(mocks.getVisibleReplyThreads).toHaveBeenCalledWith(context);
    expect(res.body).toMatchObject({
      leads: [{ row_number: 18, name: 'Reply Lead' }],
      threads: { 18: [{ id: '1', body: 'Need help' }] },
      meta: { 18: { preview: 'Need help', unread: true } },
      summary: { totalThreads: 1, unreadCount: 1 },
      unreadCount: 1,
      count: 1,
    });
  });

  it('returns a selected reply thread', async () => {
    const res = await invokeRouter({ method: 'GET', url: '/18', context });

    expect(res.statusCode).toBe(200);
    expect(mocks.getReplyThread).toHaveBeenCalledWith(context, 18);
    expect(res.body).toMatchObject({
      lead: { row_number: 18, name: 'Reply Lead' },
      messages: [{ id: '1', body: 'Need help' }],
      meta: { preview: 'Need help', unread: true },
    });
  });

  it('can include a selected conversation from the orchestration endpoint', async () => {
    const req = {
      method: 'GET',
      url: '/?rowNumber=18',
      path: '/',
      originalUrl: '/?rowNumber=18',
      query: { rowNumber: '18' },
      headers: {},
      body: {},
      params: {},
      currentUserContext: context,
    };
    const { res, done } = createMockResponse();
    await new Promise((resolve, reject) => {
      repliesRouter.handle(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
      done.then(resolve).catch(reject);
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.getReplyThread).toHaveBeenCalledWith(context, 18);
    expect(res.body).toMatchObject({
      selectedConversation: {
        lead: { row_number: 18, name: 'Reply Lead' },
        messages: [{ id: '1', body: 'Need help' }],
      },
    });
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getCurrentUserContext.mockReturnValue(null);

    const res = await invokeRouter({ context: null });
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});
