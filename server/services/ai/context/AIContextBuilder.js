import { Lead } from '../../../domain/leads/Lead.js';
import { Conversation } from '../../../domain/conversations/Conversation.js';
import { getLeadByRowNumber, getVisibleLeads } from '../../crmData/leadQueries.js';
import {
  getVisibleReplyThreads,
  getReplyThread,
} from '../../crmData/replies/replyQueries.js';
import {
  getDashboardData,
} from '../../crmData/dashboard/dashboardQueries.js';

const AI_CONTEXT_VERSION = 'ai-context-v1';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRowNumber(rowNumber) {
  const parsed = Number.parseInt(String(rowNumber ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseFlag(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function currentUserSnapshot(context) {
  if (!context || typeof context !== 'object') return null;
  const displayName = normalizeText(context.displayName || context.name || '');
  return {
    userId: context.userId ?? null,
    organizationId: context.organizationId ?? null,
    role: context.role ?? null,
    initials: context.initials ?? null,
    displayName: displayName || null,
    name: normalizeText(context.name || displayName) || null,
    email: normalizeText(context.email) || null,
    status: context.status ?? null,
  };
}

function featureFlagState() {
  return {
    SCOPED_LEAD_ACCESS_ENABLED: parseFlag(process.env.SCOPED_LEAD_ACCESS_ENABLED),
  };
}

function sourceSnapshot(queryServices, extra = {}) {
  return {
    queryServices,
    generatedAt: new Date().toISOString(),
    contextVersion: AI_CONTEXT_VERSION,
    ...extra,
  };
}

function leadPermissions(context, lead) {
  const visibility = lead?.visibility || {};
  return {
    canView: Boolean(lead?.visibility?.canView ?? false),
    canEdit: Boolean(lead?.visibility?.canEdit ?? false),
    scope: visibility.scope || 'unknown',
    featureFlagState: featureFlagState(),
  };
}

function conversationPermissions(context, lead) {
  const visibility = lead?.visibility || {};
  return {
    canView: Boolean(lead?.visibility?.canView ?? false),
    canEdit: Boolean(lead?.visibility?.canEdit ?? false),
    scope: visibility.scope || 'unknown',
    featureFlagState: featureFlagState(),
  };
}

function replyPermissions(context, visibility = null) {
  return {
    canView: visibility?.canView ?? false,
    canEdit: visibility?.canEdit ?? false,
    scope: visibility?.scope || 'unknown',
    featureFlagState: featureFlagState(),
  };
}

function dashboardPermissions(context) {
  return {
    canView: true,
    canEdit: false,
    scope: context?.role === 'admin' || context?.role === 'manager'
      ? 'organization'
      : 'owned',
    featureFlagState: featureFlagState(),
  };
}

function buildLeadPayload(context, rawLead) {
  if (!rawLead) return null;
  const entity = Lead.fromRaw(rawLead, context);
  const lead = entity.toJSON();
  return {
    ...lead,
    actionable: entity.isActionable(),
    needsFollowUp: entity.needsFollowUp(),
  };
}

function buildConversationPayload(context, rawLead, conversation) {
  if (!rawLead) return null;
  const entity = Lead.fromRaw(rawLead, context);
  const lead = entity.toJSON();
  const convo = conversation instanceof Conversation
    ? conversation
    : Conversation.fromMessages([], {}, rawLead);
  const convoJSON = convo.toJSON();
  return {
    lead,
    conversation: convoJSON,
    summary: convo.summary(),
    preview: convo.preview(),
    latestCustomerMessage: convo.latestCustomerMessage(),
    latestAgentMessage: convo.latestAgentMessage(),
    requiresReply: convo.requiresReply(),
    customerWaiting: convo.customerWaiting(),
    unread: convo.isUnread(),
    responseTime: convo.responseTime(),
  };
}

function buildReplyPayload(context, replyThreads, selectedThread = null) {
  const selected = selectedThread
    ? {
        lead: selectedThread.lead || null,
        conversation: selectedThread.conversation || null,
        messages: selectedThread.messages || [],
        metadata: selectedThread.meta || selectedThread.metadata || null,
        summary: selectedThread.summary || null,
        unread: selectedThread.conversation?.unread ?? selectedThread.unread ?? false,
      }
    : null;

  return {
    selectedThread: selected,
    messages: selected?.messages || [],
    metadata: selected?.metadata || null,
    unread: selected?.unread ?? false,
    sidebar: replyThreads.sidebar || [],
    summary: replyThreads.summary || null,
    unreadCount: replyThreads.unreadCount ?? 0,
    unreadRowNumbers: replyThreads.unreadRowNumbers || [],
    threads: replyThreads.leads || [],
  };
}

export async function buildLeadContext(context, rowNumber) {
  const normalizedRow = normalizeRowNumber(rowNumber);
  if (!normalizedRow) return null;

  const lead = await getLeadByRowNumber(context, normalizedRow);
  if (!lead?.visibility?.canView) return null;

  const payload = buildLeadPayload(context, lead);
  return {
    currentUser: currentUserSnapshot(context),
    lead: payload,
    permissions: leadPermissions(context, lead),
    source: sourceSnapshot(['crmData.leadQueries.getLeadByRowNumber', 'Lead', 'CurrentUserContext'], {
      rowNumber: normalizedRow,
    }),
  };
}

export async function buildConversationContext(context, rowNumber) {
  const normalizedRow = normalizeRowNumber(rowNumber);
  if (!normalizedRow) return null;

  let thread = null;
  try {
    thread = await getReplyThread(context, normalizedRow);
  } catch (err) {
    if (!err || (err.status !== 404 && err.code !== 'NOT_FOUND')) {
      throw err;
    }
  }

  const lead = thread?.lead || await getLeadByRowNumber(context, normalizedRow);
  if (!lead?.visibility?.canView) return null;

  const conversation = thread?.conversation
    ? Conversation.fromMessages(thread.messages || [], thread.meta || thread.conversation?.metadata || {}, lead)
    : Conversation.fromMessages([], {}, lead);

  const payload = buildConversationPayload(context, lead, conversation);
  return {
    currentUser: currentUserSnapshot(context),
    ...payload,
    permissions: conversationPermissions(context, lead),
    source: sourceSnapshot([
      'crmData.replies.replyQueries.getReplyThread',
      'crmData.leadQueries.getLeadByRowNumber',
      'Conversation',
      'Lead',
      'CurrentUserContext',
    ], {
      rowNumber: normalizedRow,
      threadLoaded: Boolean(thread),
    }),
  };
}

export async function buildReplyContext(context, rowNumber = null) {
  const replyThreads = await getVisibleReplyThreads(context);

  if (rowNumber == null || String(rowNumber).trim() === '') {
    return {
      currentUser: currentUserSnapshot(context),
      reply: buildReplyPayload(context, replyThreads, null),
      permissions: replyPermissions(context, replyThreads.visibility),
      source: sourceSnapshot([
        'crmData.replies.replyQueries.getVisibleReplyThreads',
        'Lead',
        'Conversation',
        'CurrentUserContext',
      ]),
    };
  }

  const normalizedRow = normalizeRowNumber(rowNumber);
  if (!normalizedRow) return null;

  const selectedThread = await getReplyThread(context, normalizedRow).catch((err) => {
    if (err?.status === 404 || err?.code === 'NOT_FOUND') return null;
    throw err;
  });

  if (!selectedThread) return null;

  return {
    currentUser: currentUserSnapshot(context),
    reply: buildReplyPayload(context, replyThreads, selectedThread),
    permissions: replyPermissions(context, replyThreads.visibility),
    source: sourceSnapshot([
      'crmData.replies.replyQueries.getVisibleReplyThreads',
      'crmData.replies.replyQueries.getReplyThread',
      'Lead',
      'Conversation',
      'CurrentUserContext',
    ], {
      rowNumber: normalizedRow,
    }),
  };
}

export async function buildDashboardContext(context) {
  const dashboard = await getDashboardData(context);
  return {
    currentUser: currentUserSnapshot(context),
    dashboard,
    summary: dashboard?.summary || null,
    stats: dashboard?.stats || null,
    followups: dashboard?.followups || null,
    pipelineMetrics: dashboard?.pipelineMetrics || null,
    permissions: dashboardPermissions(context),
    source: sourceSnapshot([
      'crmData.dashboard.dashboardQueries.getDashboardData',
      'Lead',
      'CurrentUserContext',
    ]),
  };
}

export async function buildSalesContext(context, options = {}) {
  const dashboard = await getDashboardData(context);
  const recentLeads = Array.isArray(dashboard?.leads) ? dashboard.leads.slice(0, 5) : [];
  return {
    currentUser: currentUserSnapshot(context),
    sales: {
      dashboard,
      summary: dashboard?.summary || null,
      stats: dashboard?.stats || null,
      followups: dashboard?.followups || null,
      pipelineMetrics: dashboard?.pipelineMetrics || null,
      activity: dashboard?.activity || null,
      recentLeads,
      leadRowNumber: normalizeRowNumber(options.rowNumber),
    },
    permissions: dashboardPermissions(context),
    source: sourceSnapshot([
      'crmData.dashboard.dashboardQueries.getDashboardData',
      'Lead',
      'CurrentUserContext',
    ], {
      rowNumber: normalizeRowNumber(options.rowNumber),
    }),
  };
}

async function mergeCompositeContext(context, options = {}) {
  const requestedSections = Array.isArray(options.sections)
    ? options.sections
    : Array.isArray(options.include)
      ? options.include
      : [];
  const uniqueSections = [...new Set(requestedSections.map((section) => normalizeText(section).toLowerCase()).filter(Boolean))];

  const output = {
    currentUser: currentUserSnapshot(context),
    source: sourceSnapshot([], { composite: true, requestedSections: uniqueSections }),
  };

  for (const section of uniqueSections) {
    if (section === 'lead') {
      output.lead = await buildLeadContext(context, options.rowNumber);
      if (!output.lead) return null;
      continue;
    }
    if (section === 'conversation') {
      output.conversation = await buildConversationContext(context, options.rowNumber);
      if (!output.conversation) return null;
      continue;
    }
    if (section === 'reply') {
      output.reply = await buildReplyContext(context, options.rowNumber);
      if (!output.reply) return null;
      continue;
    }
    if (section === 'dashboard') {
      output.dashboard = await buildDashboardContext(context);
      continue;
    }
    if (section === 'sales') {
      output.sales = await buildSalesContext(context, options);
    }
  }

  return output;
}

export async function buildAIContext(context, options = {}) {
  if (Array.isArray(options.sections) || Array.isArray(options.include)) {
    return mergeCompositeContext(context, options);
  }

  const type = normalizeText(options.type || options.kind || options.contextType || 'sales').toLowerCase();

  switch (type) {
    case 'lead':
      return buildLeadContext(context, options.rowNumber);
    case 'conversation':
      return buildConversationContext(context, options.rowNumber);
    case 'reply':
      return buildReplyContext(context, options.rowNumber);
    case 'dashboard':
      return buildDashboardContext(context);
    case 'sales':
    default:
      return buildSalesContext(context, options);
  }
}

export default {
  buildLeadContext,
  buildConversationContext,
  buildReplyContext,
  buildDashboardContext,
  buildSalesContext,
  buildAIContext,
};
