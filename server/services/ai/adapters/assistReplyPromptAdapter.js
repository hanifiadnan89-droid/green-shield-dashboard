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

export function buildAssistReplyPromptInput(aiReplyContext, fallbackLeadContext = {}) {
  const selected = aiReplyContext?.reply?.selectedThread || {};
  const lead = selected.lead || {};
  const conversation = selected.conversation || {};
  const messages = selected.messages || conversation.messages || [];
  const latestCustomerMessage = conversation.latestCustomerMessage || conversation.lastInbound || null;
  const history = conversationHistoryFromMessages(messages);

  return {
    ...fallbackLeadContext,
    row_number: lead.row_number ?? lead.rowNumber ?? fallbackLeadContext.row_number ?? fallbackLeadContext.rowNumber ?? null,
    name: lead.name || fallbackLeadContext.name || null,
    phone: lead.phone || lead.phone_formatted || fallbackLeadContext.phone || null,
    email: lead.email || fallbackLeadContext.email || null,
    town: lead.town || lead.city || fallbackLeadContext.town || null,
    address: lead.address || fallbackLeadContext.address || null,
    reason: lead.reason || fallbackLeadContext.reason || null,
    pest_type: lead.pest_type || lead.pestType || fallbackLeadContext.pest_type || null,
    lead_source: lead.lead_source || lead.source || fallbackLeadContext.lead_source || null,
    lead_stage: lead.status || lead.computedStatus || fallbackLeadContext.lead_stage || 'customer_replied',
    status: lead.status || fallbackLeadContext.status || null,
    notes: lead.notes || fallbackLeadContext.notes || null,
    sms_reply: Boolean(conversation.hasSms ?? lead.sms_reply ?? fallbackLeadContext.sms_reply),
    email_reply: Boolean(conversation.hasEmail ?? lead.email_reply ?? fallbackLeadContext.email_reply),
    last_customer_message: latestCustomerMessage?.body || lead.sms_reply || lead.email_reply || fallbackLeadContext.last_customer_message || null,
    conversation_history: history.length
      ? history
      : (Array.isArray(fallbackLeadContext.conversation_history) ? fallbackLeadContext.conversation_history : []),
    last_contacted_at: lead.sent || conversation.lastOutboundAt || fallbackLeadContext.last_contacted_at || null,
    follow_up_step: fallbackLeadContext.follow_up_step || 'follow_up_1',
    agreement_sent: fallbackLeadContext.agreement_sent || false,
    quote_sent: fallbackLeadContext.quote_sent || false,
    scheduled_date: fallbackLeadContext.scheduled_date || null,
    scheduled_window: fallbackLeadContext.scheduled_window || null,
    preferred_contact_method: lead.bestContactMethod || fallbackLeadContext.preferred_contact_method || 'SMS',
    stop: isTruthyFlag(lead.stop) || Boolean(fallbackLeadContext.stop),
    reply_archived: Boolean(fallbackLeadContext.reply_archived),
    route_availability_context: fallbackLeadContext.route_availability_context || null,
    human_review_required: Boolean(fallbackLeadContext.human_review_required),
  };
}

export default {
  buildAssistReplyPromptInput,
};
