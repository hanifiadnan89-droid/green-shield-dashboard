import { api } from '../../api/client.js';
import { hasConversationSignal } from './conversationLeadFilter.js';
import { loadLegacyViewedKeys } from './legacyViewedKeys.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function deriveSummary(leads = [], meta = {}) {
  const replyLeads = Array.isArray(leads) ? leads : [];
  const unreadCount = replyLeads.filter((lead) => meta?.[lead.row_number]?.unread).length;
  const smsReplies = replyLeads.filter((lead) => normalizeText(lead.sms_reply) && normalizeText(lead.sms_reply) !== '.').length;
  const emailReplies = replyLeads.filter((lead) => normalizeText(lead.email_reply) && normalizeText(lead.email_reply) !== '.').length;
  return {
    totalThreads: replyLeads.length,
    unreadCount,
    smsReplies,
    emailReplies,
    replied: replyLeads.length,
  };
}

export async function loadRepliesData(apiClient = api, { rowNumber = null } = {}) {
  try {
    const payload = await apiClient.replies.get({
      rowNumber,
    });
    const leads = Array.isArray(payload?.leads) ? payload.leads : [];
    const threads = payload?.threads && typeof payload.threads === 'object' ? payload.threads : {};
    const meta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {};

    return {
      source: 'replies',
      leads,
      threads,
      meta,
      summary: payload?.summary || deriveSummary(leads, meta),
      unreadCount: payload?.unreadCount ?? 0,
      count: payload?.count ?? leads.length,
      sidebar: Array.isArray(payload?.sidebar) ? payload.sidebar : [],
      payload,
    };
  } catch (repliesErr) {
    const { leads: allLeads } = await apiClient.leads.list();
    const replyLeads = (allLeads || []).filter(hasConversationSignal);
    const legacyViewedKeys = loadLegacyViewedKeys();
    const { threads, meta } = await apiClient.messages.sync(replyLeads, legacyViewedKeys);

    return {
      source: 'messages',
      leads: replyLeads,
      threads: threads || {},
      meta: meta || {},
      summary: deriveSummary(replyLeads, meta || {}),
      unreadCount: replyLeads.filter((lead) => meta?.[lead.row_number]?.unread).length,
      count: replyLeads.length,
      sidebar: [],
      repliesError: repliesErr,
    };
  }
}
