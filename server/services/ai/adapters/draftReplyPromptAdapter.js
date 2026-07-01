function normalizeRowNumber(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function findRowNumber(params = {}) {
  const candidates = [
    params.rowNumber,
    params.row_number,
    params.leadRowNumber,
    params.lead_context?.rowNumber,
    params.lead_context?.row_number,
    params.lead_context?.leadRowNumber,
  ];

  for (const candidate of candidates) {
    const rowNumber = normalizeRowNumber(candidate);
    if (rowNumber) return rowNumber;
  }
  return null;
}

function isTruthyFlag(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'yes' || normalized === 'true' || normalized === '1' || normalized === 'stop';
}

function conversationHistoryFromMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && typeof message === 'object')
    .filter((message) => !message.meta?.isTemplate)
    .map((message) => ({
      role: message.direction === 'inbound' ? 'customer' : 'agent',
      text: message.body || message.text || '',
      ts: message.ts || message.receivedAt || message.timestamp || null,
      channel: message.channel || 'sms',
    }))
    .filter((message) => message.text);
}

function selectedThreadFromContext(aiContext = {}) {
  return aiContext.reply?.reply?.selectedThread || aiContext.reply?.selectedThread || null;
}

export function buildDraftReplyContextOptions(params = {}) {
  const rowNumber = findRowNumber(params);
  if (!rowNumber) return { type: 'sales' };
  return {
    sections: ['reply', 'lead', 'conversation'],
    rowNumber,
  };
}

export function buildDraftReplyPromptInput(aiContext, params = {}) {
  const fallback = params.lead_context || {};
  const selected = selectedThreadFromContext(aiContext) || {};
  const lead = selected.lead || aiContext?.lead?.lead || {};
  const conversation = selected.conversation || aiContext?.conversation?.conversation || {};
  const messages = selected.messages || aiContext?.conversation?.conversation?.messages || [];
  const latestCustomerMessage = conversation.latestCustomerMessage
    || aiContext?.conversation?.latestCustomerMessage
    || conversation.lastInbound
    || aiContext?.conversation?.lastInbound
    || null;
  const history = conversationHistoryFromMessages(messages);

  return {
    ...fallback,
    row_number: lead.row_number ?? lead.rowNumber ?? fallback.row_number ?? fallback.rowNumber ?? null,
    name: lead.name || fallback.name || null,
    phone: lead.phone || lead.phone_formatted || fallback.phone || null,
    email: lead.email || fallback.email || null,
    town: lead.town || lead.city || fallback.town || null,
    address: lead.address || fallback.address || null,
    reason: lead.reason || fallback.reason || null,
    pest_type: lead.pest_type || lead.pestType || fallback.pest_type || null,
    lead_source: lead.lead_source || lead.source || fallback.lead_source || null,
    lead_stage: lead.status || lead.computedStatus || fallback.lead_stage || 'customer_replied',
    status: lead.status || fallback.status || null,
    notes: lead.notes || fallback.notes || null,
    sms_reply: Boolean(conversation.hasSms ?? lead.sms_reply ?? fallback.sms_reply),
    email_reply: Boolean(conversation.hasEmail ?? lead.email_reply ?? fallback.email_reply),
    last_customer_message: latestCustomerMessage?.body || lead.sms_reply || lead.email_reply || fallback.last_customer_message || null,
    conversation_history: history.length
      ? history
      : (Array.isArray(fallback.conversation_history) ? fallback.conversation_history : []),
    last_contacted_at: lead.sent || conversation.lastOutboundAt || fallback.last_contacted_at || null,
    follow_up_step: fallback.follow_up_step || 'follow_up_1',
    agreement_sent: fallback.agreement_sent || false,
    quote_sent: fallback.quote_sent || false,
    scheduled_date: fallback.scheduled_date || null,
    scheduled_window: fallback.scheduled_window || null,
    preferred_contact_method: lead.bestContactMethod || fallback.preferred_contact_method || 'SMS',
    stop: isTruthyFlag(lead.stop) || Boolean(fallback.stop),
    reply_archived: Boolean(fallback.reply_archived),
    route_availability_context: fallback.route_availability_context || null,
    human_review_required: Boolean(fallback.human_review_required),
  };
}

export default {
  buildDraftReplyContextOptions,
  buildDraftReplyPromptInput,
};
