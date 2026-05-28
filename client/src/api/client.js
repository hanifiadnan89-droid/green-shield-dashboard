const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  health: () => request('/health'),

  leads: {
    list: () => request('/leads'),
    create: (lead) => request('/leads', { method: 'POST', body: JSON.stringify(lead) }),
    update: (rowNumber, updates) => request(`/leads/${rowNumber}`, { method: 'PUT', body: JSON.stringify(updates) }),
    stop:   (rowNumber, name) => request(`/leads/${rowNumber}/stop`,   { method: 'POST',   body: JSON.stringify({ name }) }),
    unstop: (rowNumber, name) => request(`/leads/${rowNumber}/unstop`, { method: 'POST',   body: JSON.stringify({ name }) }),
    delete: (rowNumber, name) => request(`/leads/${rowNumber}`,        { method: 'DELETE', body: JSON.stringify({ name }) }),
  },

  send: (lead, template, channel) => request('/send', {
    method: 'POST',
    body: JSON.stringify({ lead, template, channel })
  }),

  sms: {
    send: (phone, message, row_number, name) => request('/send-sms', {
      method: 'POST',
      body: JSON.stringify({ phone, message, row_number, name })
    })
  },

  workflows: {
    list: () => request('/workflows')
  },

  activity: {
    list: (limit = 100) => request(`/activity?limit=${limit}`),
    clear: () => request('/activity', { method: 'DELETE' })
  },

  drive: {
    quotes: () => request('/drive/quotes')
  },

  routes: {
    payload:    (date) => request(`/routes/payload?date=${date}`),
    status:     () => request('/routes/status'),
    authStatus: () => request('/routes/auth-status'),
    authCheck:  () => request('/routes/auth-check', { method: 'POST' }),
    refresh:      (date) => request(`/routes/refresh?date=${date}`, { method: 'POST' }),
    preload:      (force = false) => request(`/routes/preload${force ? '?force=true' : ''}`, { method: 'POST' }),
    loginRefresh: () => request('/routes/login-refresh', { method: 'POST' }),
  },

  ai: {
    draftReply: (lead_context) => request('/ai/draft-reply', {
      method: 'POST',
      body: JSON.stringify({ lead_context }),
    }),
  },

  documents: {
    quotes:      () => request('/documents/quotes'),
    prepGuides:  () => request('/documents/prep-guides'),
    fileUrl:     (folder, index) => `${BASE}/documents/file?folder=${folder}&index=${index}`,
    generateQuote: (body) => request('/documents/generate-quote', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    emailQuote: (body) => request('/documents/email-quote', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }
};
