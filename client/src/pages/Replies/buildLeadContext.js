import { buildThread, archKey } from './threadUtils.js';

/**
 * CRM + conversation context for AI assist (user provides the instruction separately).
 */
export function buildLeadContext(lead, messages, { archived = new Set() } = {}) {
  const uiThread = buildThread(lead, {}, messages);
  const outboundCount = messages.filter(
    m => m.direction === 'outbound' && !m.meta?.isTemplate,
  ).length;

  let followUpStep = 'initial_outreach';
  if (outboundCount === 1) followUpStep = 'follow_up_1';
  else if (outboundCount === 2) followUpStep = 'follow_up_2';
  else if (outboundCount >= 3) followUpStep = 'final_follow_up';

  const latestInbound = [...messages].reverse().find(m => m.direction === 'inbound');
  const hasReply = !!latestInbound;
  if (hasReply && followUpStep === 'initial_outreach') followUpStep = 'follow_up_1';

  const notesLower = (lead.notes || '').toLowerCase();
  if (notesLower.includes('ag') || notesLower.includes('agreement')) {
    followUpStep = 'agreement_follow_up';
  }

  const hasEmailInbound = messages.some(m => m.direction === 'inbound' && m.channel === 'email');
  const hasSmsInbound = messages.some(m => m.direction === 'inbound' && m.channel === 'sms');
  const preferredChannel = hasEmailInbound && !hasSmsInbound ? 'email' : 'sms';

  return {
    row_number: lead.row_number || lead.rowNumber || null,
    name: lead.name || null,
    phone: lead.phone || null,
    email: lead.email || null,
    town: null,
    address: null,
    reason: lead.reason || null,
    pest_type: null,
    lead_source: null,
    lead_stage: lead.status || 'customer_replied',
    status: lead.status || null,
    notes: lead.notes || null,
    sms_reply: hasSmsInbound || !!(lead.sms_reply || '').trim(),
    email_reply: hasEmailInbound || !!(lead.email_reply || '').trim(),
    last_customer_message: latestInbound?.body || lead.sms_reply || null,
    conversation_history: uiThread
      .filter(m => !m.isTemplate)
      .map(m => ({
        role: m.dir === 'in' ? 'customer' : 'agent',
        text: m.text,
        ts: m.ts,
        channel: m.channel || 'sms',
      })),
    last_contacted_at: lead.sent || null,
    follow_up_step: followUpStep,
    agreement_sent: false,
    quote_sent: false,
    scheduled_date: null,
    scheduled_window: null,
    preferred_contact_method: preferredChannel,
    stop: !!(lead.stop && String(lead.stop).trim()),
    reply_archived: archived.has(archKey(lead)),
    route_availability_context: null,
    human_review_required: false,
  };
}
