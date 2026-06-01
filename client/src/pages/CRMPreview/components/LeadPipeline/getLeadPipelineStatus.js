/**
 * Lead pipeline row status — must match former StatusPill if-chain in LeadRow.jsx.
 * Do not use mockData._isReplied here (filter/pill semantics differ).
 */
export function getLeadPipelineStatus(lead) {
  if ((lead.error && lead.error.trim()) || lead.status === 'error' || lead.status === 'email_failed') {
    return 'error';
  }
  if (lead.stop === 'yes') {
    return 'stopped';
  }
  if (lead.sms_reply === 'yes' || lead.email_reply === 'yes' || lead.status === 'replied') {
    return 'replied';
  }
  if (lead.sent && lead.sent !== 'imported') {
    return 'in_progress';
  }
  return 'new';
}
