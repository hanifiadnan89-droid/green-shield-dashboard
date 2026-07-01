import { Lead } from '../../../domain/leads/Lead.js';
import { Conversation } from '../../../domain/conversations/Conversation.js';
import { getVisibleLeads, getLeadByRowNumber } from '../leadQueries.js';
import { getLeadVisibilityScope, isScopedLeadAccessEnabled } from '../../leadAccess.js';
import {
  countUnreadForLeads,
  getThreadMeta,
  syncLeadsMessages,
} from '../../conversationMessages.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasConversationSignal(lead) {
  const sms = normalizeText(lead?.sms_reply);
  const email = normalizeText(lead?.email_reply);
  return (sms.length > 0 && sms !== '.') || (email.length > 0 && email !== '.');
}

function parseTimeMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getReplySortTime(lead, conversation) {
  const conv = conversation instanceof Conversation
    ? conversation
    : Conversation.fromMessages([], {}, lead);
  return parseTimeMs(conv.lastActivityAt() || lead.updatedAt || lead.updated_at || lead.sent) ?? 0;
}

function enrichReplyLead(context, lead, conversation) {
  const entity = Lead.fromRaw(lead, context);
  const base = entity.toJSON();
  const conversationJSON = conversation?.toJSON?.() || {};
  return {
    ...base,
    computedStatus: entity.computedStatus(),
    displayStatus: entity.displayStatus(),
    conversation: conversationJSON,
    replyThread: {
      preview: conversationJSON.preview || '',
      lastAt: conversationJSON.lastActivityAt || null,
      unread: conversationJSON.unread ?? false,
      lastReadAt: conversationJSON.lastReadAt ?? null,
      lastReadInboundKey: conversationJSON.lastReadInboundKey ?? null,
      readInboundKeys: conversationJSON.readInboundKeys || [],
    },
  };
}

function buildReplySummary(context, entries, unreadCount) {
  const leadEntities = entries.map(({ lead }) => Lead.fromRaw(lead, context));
  return {
    totalThreads: entries.length,
    unreadCount: unreadCount?.count ?? 0,
    rowNumbers: unreadCount?.rowNumbers || [],
    smsReplies: leadEntities.filter((lead) => lead.hasSmsReply()).length,
    emailReplies: leadEntities.filter((lead) => lead.hasEmailReply()).length,
    replied: leadEntities.filter((lead) => lead.hasAnyReply()).length,
    active: leadEntities.filter((lead) => lead.isActive()).length,
    visibilityMode: getLeadVisibilityScope(context).scope,
    featureFlagState: {
      SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
    },
    latestConversationAt: entries.reduce((latest, entry) => {
      const ts = parseTimeMs(entry.conversation?.lastActivityAt?.() || entry.lead.updatedAt || entry.lead.updated_at || entry.lead.sent);
      if (ts == null) return latest;
      return Math.max(latest, ts);
    }, 0) || null,
  };
}

function buildReplySidebar(context, entries) {
  const sorted = [...entries].sort((a, b) => {
    const aMs = getReplySortTime(a.lead, a.conversation);
    const bMs = getReplySortTime(b.lead, b.conversation);
    if (aMs !== bMs) return bMs - aMs;
    return Number.parseInt(String(b.lead.row_number || 0), 10) - Number.parseInt(String(a.lead.row_number || 0), 10);
  });

  return sorted.map(({ lead, conversation }) => {
    const entity = Lead.fromRaw(lead, context);
    const conversationJSON = conversation.toJSON();
    return {
      rowNumber: lead.row_number,
      lead: entity.toJSON(),
      name: entity.name() || lead.name || '',
      preview: conversationJSON.preview || '',
      lastAt: conversationJSON.lastActivityAt || null,
      unread: !!conversationJSON.unread,
      displayStatus: entity.displayStatus(),
      computedStatus: conversationJSON.computedStatus,
      ownership: entity.getOwnership(),
      visibility: entity.getVisibility(),
      conversation: conversationJSON,
      replyThread: {
        preview: conversationJSON.preview || '',
        lastAt: conversationJSON.lastActivityAt || null,
        unread: !!conversationJSON.unread,
        lastReadAt: conversationJSON.lastReadAt ?? null,
        lastReadInboundKey: conversationJSON.lastReadInboundKey ?? null,
        readInboundKeys: conversationJSON.readInboundKeys || [],
      },
    };
  });
}

function getVisibleReplyLeads(context, leads = []) {
  const rows = Array.isArray(leads) ? leads : [];
  return rows.filter(hasConversationSignal);
}

export async function getVisibleReplyThreads(context, options = {}) {
  const replyLeads = getVisibleReplyLeads(context, await getVisibleLeads(context));
  const { threads, meta } = syncLeadsMessages(replyLeads, {
    legacyViewedKeys: Array.isArray(options.legacyViewedKeys) ? options.legacyViewedKeys : [],
  });
  const unreadCount = countUnreadForLeads(replyLeads);
  const entries = replyLeads.map((lead) => {
    const conversation = Conversation.fromMessages(threads?.[lead.row_number] || [], meta?.[lead.row_number] || {}, lead);
    return { lead, conversation };
  });
  const summary = buildReplySummary(context, entries, unreadCount);
  const sidebar = buildReplySidebar(context, entries);
  const enrichedLeads = entries.map(({ lead, conversation }) => enrichReplyLead(context, lead, conversation));

  return {
    leads: enrichedLeads,
    threads,
    meta,
    sidebar,
    summary,
    unreadCount: unreadCount.count,
    unreadRowNumbers: unreadCount.rowNumbers,
    count: enrichedLeads.length,
    visibility: getLeadVisibilityScope(context),
    featureFlagState: {
      SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
    },
  };
}

export async function getReplyThread(context, rowNumber, options = {}) {
  const replyLeads = getVisibleReplyLeads(context, await getVisibleLeads(context));
  const normalizedRow = Number.parseInt(String(rowNumber ?? '').trim(), 10);
  if (!normalizedRow) {
    const err = new Error('Invalid row number');
    err.code = 'VALIDATION_ERROR';
    err.status = 400;
    throw err;
  }
  const lead = await getLeadByRowNumber(context, normalizedRow);
  if (!lead || !hasConversationSignal(lead)) {
    const err = new Error('Reply thread not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const leadInScope = replyLeads.find((item) => Number.parseInt(String(item.row_number), 10) === normalizedRow) || lead;
  const { messages, ...threadMeta } = syncLeadsMessages(leadInScope, {
    legacyViewedKeys: Array.isArray(options.legacyViewedKeys) ? options.legacyViewedKeys : [],
  });
  const conversation = Conversation.fromMessages(messages, threadMeta, leadInScope);
  const entries = replyLeads.map((lead) => ({
    lead,
    conversation: lead.row_number === normalizedRow
      ? conversation
      : Conversation.fromMessages([], {}, lead),
  }));

  return {
    lead: enrichReplyLead(context, leadInScope, conversation),
    conversation: conversation.toJSON(),
    messages,
    meta: {
      ...getThreadMeta(normalizedRow, leadInScope),
      ...conversation.toJSON(),
    },
    summary: buildReplySummary(context, entries, countUnreadForLeads(replyLeads)),
    visibility: getLeadVisibilityScope(context),
    featureFlagState: {
      SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
    },
  };
}

export async function getConversationMessages(context, rowNumber, options = {}) {
  const thread = await getReplyThread(context, rowNumber, options);
  return thread.messages || [];
}

export async function getUnreadReplyCount(context, options = {}) {
  const replyLeads = getVisibleReplyLeads(context, await getVisibleLeads(context));
  const unreadCount = countUnreadForLeads(replyLeads);
  return {
    ...unreadCount,
    visibility: getLeadVisibilityScope(context),
    featureFlagState: {
      SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
    },
  };
}

export async function getReplySidebar(context, options = {}) {
  const payload = await getVisibleReplyThreads(context, options);
  return payload.sidebar;
}

export async function getReplySummary(context, options = {}) {
  const payload = await getVisibleReplyThreads(context, options);
  return payload.summary;
}
