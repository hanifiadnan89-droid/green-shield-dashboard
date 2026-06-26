const BASE = '/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch (networkErr) {
    const err = new Error(networkErr.message || 'Failed to fetch');
    err.cause = networkErr;
    err.isNetworkError = true;
    throw err;
  }

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw.trim() || res.statusText };
  }

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    if (data.code) err.code = data.code;
    if (data.hint) err.hint = data.hint;
    err.httpStatus = res.status;
    throw err;
  }
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

  messages: {
    sync: (leads, legacyViewedKeys = []) => request('/messages/sync', {
      method: 'POST',
      body: JSON.stringify({ leads, legacyViewedKeys }),
    }),
    migrateLocal: (history) => request('/messages/migrate-local', {
      method: 'POST',
      body: JSON.stringify({ history }),
    }),
    unreadCount: (leads, legacyViewedKeys = []) => request('/messages/unread-count', {
      method: 'POST',
      body: JSON.stringify({
        leads,
        legacyViewedKeys: Array.isArray(legacyViewedKeys) ? legacyViewedKeys : [],
      }),
    }),
    markRead: (rowNumber, inboundKey) => request(`/messages/${rowNumber}/read`, {
      method: 'POST',
      body: JSON.stringify({ inboundKey }),
    }),
    markReadAll: (rowNumber) => request(`/messages/${rowNumber}/read-all`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    list: (rowNumber) => request(`/messages/${rowNumber}`),
    append: (rowNumber, message) => request(`/messages/${rowNumber}`, {
      method: 'POST',
      body: JSON.stringify(message),
    }),
  },

  workflows: {
    list: () => request('/workflows')
  },

  activity: {
    list: (limit = 100) => request(`/activity?limit=${limit}`),
    clear: () => request('/activity', { method: 'DELETE' })
  },

  activityErrors: {
    list: () => request('/activity-errors'),
    complete: (rowNumber) => request(`/activity-errors/${rowNumber}/complete`, { method: 'POST' }),
  },

  drive: {
    quotes: () => request('/drive/quotes')
  },

  geocode: {
    suggest: (q) => request(`/geocode/suggest?q=${encodeURIComponent(q)}`),
    lookup: (q) => request(`/geocode/lookup?q=${encodeURIComponent(q)}`),
    status: () => request('/geocode/status'),
  },

  intake: {
    status: () => request('/intake/status'),
    validateAddress: (body) => request('/intake/validate-address', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    geocode: (body) => request('/intake/geocode', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    weather: ({ date, lat, lng }) => request(
      `/intake/weather?date=${encodeURIComponent(date)}&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    ),
    propertyRecords: (body) => request('/intake/property-records', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    propertyRecordsUsage: () => request('/intake/property-records/usage'),
  },

  routes: {
    payload:    (date) => request(`/routes/payload?date=${date}`),
    status:     () => request('/routes/status'),
    authStatus: () => request('/routes/auth-status'),
    authCheck:  (force = false) => request(`/routes/auth-check${force ? '?force=true' : ''}`, { method: 'POST' }),
    loginCapabilities: () => request('/routes/login-capabilities'),
    authDiagnostics: (runCheck = false) =>
      request(`/routes/auth-diagnostics${runCheck ? '?check=true' : ''}`),
    applyAuthState: (payload) => {
      let body;
      if (typeof payload === 'string') {
        body = { raw: payload.trim() };
      } else if (typeof payload?.raw === 'string') {
        body = { raw: payload.raw.trim() };
      } else if (Array.isArray(payload?.cookies)) {
        body = payload;
      } else {
        body = { storageState: payload };
      }
      return request('/routes/auth-state', { method: 'POST', body: JSON.stringify(body) });
    },
    refreshServerAuth: () => request('/routes/auth-refresh-server', { method: 'POST' }),
    refresh:      (date) => request(`/routes/refresh?date=${date}`, { method: 'POST' }),
    preload:      (force = false) => request(`/routes/preload${force ? '?force=true' : ''}`, { method: 'POST' }),
    backgroundRefresh: (priorityDates = []) => request('/routes/background-refresh', {
      method: 'POST',
      body: JSON.stringify({ priorityDates }),
    }),
    loginRefresh: () => request('/routes/login-refresh', { method: 'POST' }),
    technicianPhotos: (refresh = false) =>
      request(`/routes/technician-photos${refresh ? '?refresh=true' : ''}`),
    travelLegs: (body) => request('/routes/travel-legs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    travelStatus: () => request('/routes/travel-status'),
    roadPolyline: (body) => request('/routes/road-polyline', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  },

  salesCoach: {
    runModule: (body) => request('/ai/sales-coach/module', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    sessions: (params = {}) => {
      const qs = new URLSearchParams();
      if (params.limit)  qs.set('limit',  String(params.limit));
      if (params.module) qs.set('module', params.module);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request(`/ai/sales-coach/sessions${suffix}`);
    },
    training: {
      list:   (type) => {
        const qs = type ? `?type=${encodeURIComponent(type)}` : '';
        return request(`/ai/sales-coach/training${qs}`);
      },
      create: (body) => request('/ai/sales-coach/training', { method: 'POST', body: JSON.stringify(body) }),
      update: (id, body) => request(`/ai/sales-coach/training/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
      delete: (id) => request(`/ai/sales-coach/training/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    },
  },

  ai: {
    assistReply: (lead_context, user_prompt, current_draft = '') => request('/ai/assist-reply', {
      method: 'POST',
      body: JSON.stringify({ lead_context, user_prompt, current_draft }),
    }),
    /** @deprecated */
    draftReply: (lead_context) => request('/ai/draft-reply', {
      method: 'POST',
      body: JSON.stringify({ lead_context }),
    }),
    objectionAssist: (body) => request('/ai/objection-assist', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    salesCoach: (body) => request('/ai/sales-coach', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    objectionFeedback: (body) => request('/ai/objection-feedback', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    objectionOutcome: (body) => request('/ai/objection-outcome', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    coachObjection: (body) => request('/ai/coach-objection', {
      method: 'POST',
      body: JSON.stringify(body),
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
  },

  signing: {
    sessions: (params = {}) => {
      const qs = new URLSearchParams();
      if (params.leadRow != null) qs.set('leadRow', String(params.leadRow));
      if (params.status) qs.set('status', params.status);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request(`/signing/sessions${suffix}`);
    },
    session: (token) => request(`/signing/sessions/${encodeURIComponent(token)}`),
    signedPdfUrl: (token) => `${BASE}/signing/sessions/${encodeURIComponent(token)}/signed.pdf`,
  }
};
