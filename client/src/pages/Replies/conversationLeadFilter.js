/** Leads that belong in Replies / unread tracking (SMS or email inbound). */
export function hasConversationSignal(lead) {
  const sms = (lead?.sms_reply || '').trim();
  const email = (lead?.email_reply || '').trim();
  return (sms.length > 0 && sms !== '.') || (email.length > 0 && email !== '.');
}

export function filterConversationLeads(leads) {
  return (leads || []).filter(hasConversationSignal);
}
